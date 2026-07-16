import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SessionService } from '../session/session.service';
import { EventBusService } from '../events/events.service';
import { buildShareCard, buildShareLinkCard, buildEndedCard, buildHelpCard, getCoverUrl } from './card-builder';
import { KookClient, KookMessageEvent, KookButtonClickEvent } from './kook-client';

@Injectable()
export class KookService implements OnModuleInit {
  private readonly logger = new Logger(KookService.name);
  private bot: KookClient | null = null;
  /** 已处理的消息 ID 去重（LRU 式，防止 WebSocket 重连后重放导致重复处理） */
  private processedMessageIds = new Set<string>();
  private readonly MAX_PROCESSED_IDS = 500;
  /** 用户+频道维度的触发频率限制，防止快速连发导致重复创建 session */
  private recentTriggers = new Map<string, number>();
  private readonly TRIGGER_COOLDOWN_MS = 10000; // 10 秒冷却

  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly bus: EventBusService,
  ) {}

  async onModuleInit() {
    this.bus.onSessionStarted((event) => this.handleSessionStarted(event));
    this.bus.onSessionEnded((event) => this.handleSessionEnded(event));
    await this.config.ensureLoaded();
    await this.startBot();
  }

  async startBot() {
    const token = this.config.get().kook.botToken;
    if (!token) {
      this.logger.warn('KOOK bot token not configured, set it in admin panel');
      return;
    }
    try {
      this.bot = new KookClient(token);

      this.bot.on('ready', (user: any) => {
        this.logger.log('KOOK bot ready: ' + (user?.username || ''));
      });
      this.bot.on('error', (err: any) => {
        this.logger.error('KOOK bot error: ' + (err?.message || err));
      });
      this.bot.on('close', (code: number) => {
        this.logger.warn(`KOOK bot connection closed (code: ${code})`);
      });
      this.bot.on('message', async (event: KookMessageEvent) => {
        await this.handleMessage(event);
      });
      this.bot.on('button_click', async (event: KookButtonClickEvent) => {
        await this.handleButtonClick(event);
      });

      this.logger.log('KOOK bot starting...');
      await this.bot.start();
    } catch (err: any) {
      this.logger.error('KOOK bot init failed: ' + (err?.message || err));
    }
  }

  get isRunning(): boolean {
    return this.bot?.isRunning() ?? false;
  }

  private async handleMessage(event: KookMessageEvent) {
    const content = (event.content || '').trim();
    if (!content) return;

    // 消息 ID 去重：防止 WebSocket 重连后消息重放导致重复处理
    if (event.id) {
      if (this.processedMessageIds.has(event.id)) {
        this.logger.warn(`duplicate message ignored: ${event.id}`);
        return;
      }
      this.processedMessageIds.add(event.id);
      // 清理旧 ID，防止内存无限增长
      if (this.processedMessageIds.size > this.MAX_PROCESSED_IDS) {
        const firstId = this.processedMessageIds.values().next().value;
        if (firstId) this.processedMessageIds.delete(firstId);
      }
    }

    // 忽略机器人自己发的消息，防止死循环（三重保险）
    const botId = this.bot?.getBotId();
    const authorId = event.author_id || event.extra?.author?.id || '';
    if (botId && authorId === botId) return;
    if (this.bot?.isOwnMessage(event.id)) return;
    // 卡片消息（content 是 JSON 数组）不可能是普通用户发的，直接跳过
    if (content.startsWith('[')) return;

    // 直接匹配触发词（不含斜杠），任何消息包含触发词即触发
    const triggerWordsStr = this.config.get().kook.triggerWords || '屏幕共享';
    const triggerWords = triggerWordsStr
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);

    // 帮助指令
    if (content === '帮助' || content === 'help' || content === '/帮助' || content === '/help') {
      await this.sendHelp(event.target_id);
      return;
    }

    // 检查是否包含任意触发词
    const matched = triggerWords.some((word) => content.includes(word));
    if (matched) {
      this.logger.debug(
        `KOOK message: target_id=${event.target_id}, ` +
        `guild_id=${event.guild_id || '(none)'}, ` +
        `extra.guild_id=${event.extra?.guild_id || '(none)'}, ` +
        `author_id=${event.author_id || event.extra?.author?.id || '(none)'}, ` +
        `extra keys=${event.extra ? Object.keys(event.extra).join(',') : '(no extra)'}`,
      );
      // 用户+频道维度频率限制，防止快速连发重复创建 session
      const channelId =
        event.target_id || event.channel_id || event.extra?.channel_id || '';
      const cooldownKey = `${authorId}:${channelId}`;
      const lastTrigger = this.recentTriggers.get(cooldownKey);
      if (lastTrigger && Date.now() - lastTrigger < this.TRIGGER_COOLDOWN_MS) {
        this.logger.warn(
          `trigger cooldown: ${authorId} in ${channelId}, ignoring (within ${this.TRIGGER_COOLDOWN_MS}ms)`,
        );
        return;
      }
      this.recentTriggers.set(cooldownKey, Date.now());
      // 清理过期的冷却记录
      if (this.recentTriggers.size > 100) {
        const now = Date.now();
        for (const [k, v] of this.recentTriggers) {
          if (now - v > this.TRIGGER_COOLDOWN_MS * 2) {
            this.recentTriggers.delete(k);
          }
        }
      }

      await this.handleShareCommand(event);
    }
  }

  private async handleShareCommand(event: KookMessageEvent) {
    const guildId = event.guild_id || event.extra?.guild_id || '';
    const authorId = event.author_id || event.extra?.author?.id || '';
    const authorName = event.extra?.author?.username || 'KOOK用户';
    const channelId =
      event.target_id || event.channel_id || event.extra?.channel_id || '';

    const session = this.sessionService.createSession({
      sharerUserId: authorId,
      sharerUsername: authorName,
      guildId,
      targetChannelId: channelId,
    });

    const shareLink = this.config.buildShareLink(session.token);

    // 发送共享链接卡片（带「开始共享」与「点击观看」按钮）
    const card = buildShareLinkCard({
      sharerUsername: authorName,
      shareUrl: shareLink,
      viewUrl: this.config.buildViewLink(session.token),
    });
    try {
      await this.bot?.sendCardMessage(channelId, card);
      this.logger.log(`share link card sent to ${channelId} for ${authorName}`);
    } catch (err: any) {
      this.logger.error('send share link card failed: ' + (err?.message || err));
      // 卡片发送失败时降级为纯文本
      await this.bot?.sendKMarkdownMessage(
        channelId,
        '屏幕共享已创建，点击链接开始共享：' + shareLink,
      );
    }
  }

  /** 处理卡片按钮点击回调（如「重新发起共享」） */
  private async handleButtonClick(event: KookButtonClickEvent) {
    this.logger.log(
      `button_click: value=${event.value}, user=${event.username}(${event.userId}), ` +
      `channel=${event.targetId}, guild=${event.guildId || '(none)'}`,
    );

    if (event.value !== 'reshare') return;

    // 检查用户是否有活跃的共享会话
    if (this.sessionService.hasActiveSession(event.userId)) {
      this.logger.warn(`button_click rejected: user ${event.userId} already has an active session`);
      // 可以发送提示消息，但为了避免消息轰炸，暂时只记录日志
      return;
    }

    // 频率限制，防止快速连点重复创建 session
    const cooldownKey = `${event.userId}:${event.targetId}`;
    const lastTrigger = this.recentTriggers.get(cooldownKey);
    if (lastTrigger && Date.now() - lastTrigger < this.TRIGGER_COOLDOWN_MS) {
      this.logger.warn(`button_click cooldown: ${event.userId} in ${event.targetId}`);
      return;
    }
    this.recentTriggers.set(cooldownKey, Date.now());

    const authorName = event.username || 'KOOK用户';
    const session = this.sessionService.createSession({
      sharerUserId: event.userId,
      sharerUsername: authorName,
      guildId: event.guildId,
      targetChannelId: event.targetId,
    });

    const shareLink = this.config.buildShareLink(session.token);
    const card = buildShareLinkCard({
      sharerUsername: authorName,
      shareUrl: shareLink,
      viewUrl: this.config.buildViewLink(session.token),
    });

    try {
      await this.bot?.sendCardMessage(event.targetId, card);
      this.logger.log(`reshare card sent to ${event.targetId} for ${authorName}`);
    } catch (err: any) {
      this.logger.error('reshare send card failed: ' + (err?.message || err));
    }
  }

  private async handleSessionStarted(event: {
    sessionId: string;
    sharerUsername: string;
    targetChannelId: string;
  }) {
    this.logger.log(
      `handleSessionStarted: sessionId=${event.sessionId}, targetChannelId=${event.targetChannelId || '(empty)'}, bot=${!!this.bot}, isRunning=${this.bot?.isRunning()}`,
    );

    if (!this.bot || !this.bot.isRunning()) {
      this.logger.warn('handleSessionStarted: bot not running, skipping card push');
      return;
    }

    if (!event.targetChannelId) {
      this.logger.warn('handleSessionStarted: targetChannelId is empty, skipping card push (manual share?)');
      return;
    }

    const session = this.sessionService.getById(event.sessionId);
    if (!session) {
      this.logger.warn(`handleSessionStarted: session ${event.sessionId} not found`);
      return;
    }

    const card = buildShareCard({
      sharerUsername: event.sharerUsername,
      viewUrl: this.config.buildViewLink(session.token),
      coverUrl: getCoverUrl(this.config),
    });

    try {
      this.logger.log(`handleSessionStarted: sending card to channel ${event.targetChannelId}`);
      const result = await this.bot.sendCardMessage(
        event.targetChannelId,
        card,
      );
      const msgId = result?.msg_id || result?.data?.msg_id;
      if (msgId) {
        this.sessionService.setCardMessageId(event.sessionId, msgId);
      }
      this.logger.log(`handleSessionStarted: card pushed successfully, msgId=${msgId || 'none'}`);
    } catch (err: any) {
      this.logger.error('handleSessionStarted: push card failed: ' + (err?.message || err));
    }
  }

  private async handleSessionEnded(event: {
    sessionId: string;
    targetChannelId?: string;
    cardMessageId?: string;
    reason: string;
  }) {
    this.logger.log(
      `handleSessionEnded: sessionId=${event.sessionId}, reason=${event.reason}, ` +
      `cardMessageId=${event.cardMessageId || '(none)'}, targetChannelId=${event.targetChannelId || '(none)'}, ` +
      `botRunning=${this.bot?.isRunning() ?? false}`,
    );

    if (!this.bot || !this.bot.isRunning()) {
      this.logger.warn(
        `handleSessionEnded: bot not running, skip for ${event.sessionId}`,
      );
      return;
    }

    // 发送「已结束」小卡片（带统计信息和重新发起回调按钮），不修改原卡片
    if (event.targetChannelId) {
      try {
        const session = this.sessionService.getById(event.sessionId);
        
        // 计算计费时长
        const info = session ? this.sessionService.toInfo(session) : null;
        const billingMinutes = info?.billingMinutes || 0;
        
        const endedCard = buildEndedCard({
          totalViewerJoins: session?.totalViewerJoins || 0,
          durationMs: session?.durationMs || null,
          billingMinutes,
        });
        await this.bot.sendCardMessage(event.targetChannelId, endedCard);
        this.logger.log(`ended card sent to ${event.targetChannelId}`);
      } catch (err: any) {
        this.logger.error('send ended card failed: ' + (err?.message || err));
      }
    }
  }

  /** 推送共享链接卡片到指定频道（供 reshare 端点调用） */
  async pushShareLinkCard(channelId: string, sharerUsername: string): Promise<string | null> {
    const session = this.sessionService.createSession({
      sharerUserId: 'reshare',
      sharerUsername,
      guildId: '',
      targetChannelId: channelId,
    });
    const shareLink = this.config.buildShareLink(session.token);
    const card = buildShareLinkCard({
      sharerUsername,
      shareUrl: shareLink,
      viewUrl: this.config.buildViewLink(session.token),
    });
    try {
      await this.bot?.sendCardMessage(channelId, card);
      this.logger.log(`reshare: share link card pushed to ${channelId}`);
      return shareLink;
    } catch (err: any) {
      this.logger.error('reshare: push share link card failed: ' + (err?.message || err));
      return null;
    }
  }

  private async sendHelp(channelId: string) {
    const card = buildHelpCard();
    try {
      await this.bot?.sendCardMessage(channelId, card);
    } catch (err: any) {
      this.logger.error('send help card failed: ' + (err?.message || err));
    }
  }
}
