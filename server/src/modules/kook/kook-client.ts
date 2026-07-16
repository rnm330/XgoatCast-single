import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';

/**
 * KOOK (KaiHeiLa) Bot WebSocket 客户端
 * 严格参照 khl.py (https://github.com/TWT233/khl.py) 实现
 *
 * 协议说明：
 * 1. 用 Token 获取 gateway URL
 * 2. 连接 WebSocket（gateway URL 本身已鉴权）
 * 3. 不需要发送 identify 信号（与 Discord 协议不同）
 * 4. 定时发送心跳 {s: 2, sn: <last_sn>}
 * 5. 接收所有 s:0 消息（hello / 事件）
 */

const API_BASE = 'https://www.kookapp.cn/api/v3';
const HEARTBEAT_INTERVAL_MS = 26000;

// WebSocket 信号类型（参照 KOOK 官方文档）
const S_EVENT = 0;        // 事件信号
const S_HELLO = 1;        // 握手信号（连接成功后服务器推送）
const S_HEARTBEAT = 2;    // 心跳（客户端发送）
const S_HEARTBEAT_ACK = 3; // 心跳 ACK（服务器回复）
const S_RESUME = 4;       // 恢复连接
const S_RECONNECT = 5;    // 服务端要求重连
const S_RESUME_ACK = 6;   // 恢复连接成功

export interface KookMessageEvent {
  id?: string;
  content: string;
  target_id: string;
  channel_id?: string;
  guild_id?: string;
  author_id?: string;
  extra?: {
    guild_id?: string;
    author?: { id?: string; username?: string };
    channel_id?: string;
  };
}

export interface KookButtonClickEvent {
  msgId: string;
  userId: string;
  username: string;
  targetId: string;
  guildId: string;
  value: string;
}

export class KookClient extends EventEmitter {
  private readonly logger = new Logger('KookClient');
  private ws: any = null;
  private token: string;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private sessionId: string | null = null;
  private lastSn = 0;
  private manualClose = false;
  private connected = false;
  private botId: string | null = null;
  /** 机器人自身发出的消息 ID 集合，用于过滤回声，防止自触发死循环 */
  private sentMessageIds = new Set<string>();

  constructor(token: string) {
    super();
    this.token = token;
  }

  /** 获取机器人自身的用户 ID */
  getBotId(): string | null {
    return this.botId;
  }

  /** 记录机器人自身发出的消息 ID（用于回声过滤） */
  registerSentMessage(id: string): void {
    if (id) this.sentMessageIds.add(id);
  }

  /** 该消息是否为机器人自身发出的回声 */
  isOwnMessage(id?: string): boolean {
    return !!id && this.sentMessageIds.has(id);
  }

  /** 启动机器人：获取网关 → 连接 WebSocket */
  async start(): Promise<void> {
    const gatewayUrl = await this.getGatewayUrl();
    if (!gatewayUrl) {
      throw new Error('Failed to get KOOK gateway URL');
    }
    this.logger.log(`KOOK gateway: ${gatewayUrl}`);
    await this.connect(gatewayUrl);
  }

  /** 停止机器人 */
  async stop(): Promise<void> {
    this.manualClose = true;
    this.cleanup();
  }

  /** 是否已连接 */
  isRunning(): boolean {
    return this.connected;
  }

  // ===== HTTP API =====

  /** 获取 WebSocket 网关地址（参照 khl.py receiver._get_gateway） */
  private async getGatewayUrl(): Promise<string | null> {
    try {
      const url = `${API_BASE}/gateway/index?compress=0`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bot ${this.token}` },
      });
      const data = (await resp.json()) as any;
      if (data.code !== 0) {
        this.logger.error(`KOOK gateway error: code=${data.code} message=${data.message}`);
        return null;
      }
      this.sessionId = data.data?.session_id || null;
      return data.data?.url;
    } catch (err: any) {
      this.logger.error(`KOOK gateway fetch failed: ${err.message}`);
      return null;
    }
  }

  /** 发送文字消息 (type=1) */
  async sendTextMessage(channelId: string, content: string): Promise<any> {
    return this.postApi('/message/create', { target_id: channelId, content, type: 1 });
  }

  /** 发送 KMarkdown 消息 (type=9) */
  async sendKMarkdownMessage(channelId: string, content: string): Promise<any> {
    return this.postApi('/message/create', { target_id: channelId, content, type: 9 });
  }

  /** 发送卡片消息 (type=10) */
  async sendCardMessage(channelId: string, cards: unknown): Promise<any> {
    return this.postApi('/message/create', {
      target_id: channelId,
      type: 10,
      content: typeof cards === 'string' ? cards : JSON.stringify(cards),
    });
  }

  /** 更新消息内容（编辑卡片等） */
  async updateMessage(msgId: string, content: string, type: number): Promise<any> {
    return this.postApi('/message/update', { msg_id: msgId, content, type });
  }

  /** 删除消息 */
  async deleteMessage(msgId: string): Promise<any> {
    return this.postApi('/message/delete', { msg_id: msgId });
  }

  /** 通用 POST 请求 */
  private async postApi(path: string, body: any): Promise<any> {
    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      this.logger.error(`KOOK API ${path} network failed: ${err.message}`);
      throw err;
    }
    let data: any;
    try {
      data = (await resp.json()) as any;
    } catch (err: any) {
      this.logger.error(`KOOK API ${path} invalid JSON: ${err.message}`);
      throw new Error(`KOOK API ${path} invalid response`);
    }
    if (data.code !== 0) {
      const msg = `KOOK API ${path} error: code=${data.code} message=${data.message}`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    // 记录自己发出的消息 ID，用于回声过滤（防止自触发死循环）
    const sentId = data?.data?.msg_id || data?.data?.id || data?.msg_id;
    if (sentId) this.registerSentMessage(sentId);
    return data.data || data;
  }

  // ===== WebSocket =====

  private async connect(gatewayUrl: string): Promise<void> {
    const { WebSocket } = await import('ws');
    this.ws = new WebSocket(gatewayUrl);
    this.manualClose = false;

    this.ws.on('open', () => {
      this.logger.log('KOOK WebSocket connected');
      this.startHeartbeat();
    });

    this.ws.on('message', (raw: Buffer | string) => {
      try {
        const data = typeof raw === 'string' ? raw : raw.toString();
        const msg = JSON.parse(data);
        // 调试日志
        const summary: any = { s: msg.s };
        if (msg.sn !== undefined) summary.sn = msg.sn;
        if (msg.d) {
          if (msg.d.code !== undefined) summary.code = msg.d.code;
          if (msg.d.type !== undefined) summary.type = msg.d.type;
          if (msg.d.event_type) summary.event_type = msg.d.event_type;
        }
        this.logger.debug(`KOOK WS recv: ${JSON.stringify(summary)}`);
        this.handleSignal(msg);
      } catch (err: any) {
        this.logger.error(`KOOK WS parse error: ${err.message}`);
      }
    });

    this.ws.on('close', (code: number) => {
      this.logger.warn(`KOOK WebSocket closed: code=${code}`);
      this.connected = false;
      this.emit('close', code);
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      this.logger.error(`KOOK WebSocket error: ${err.message}`);
      this.emit('error', err);
    });
  }

  /** 处理收到的信号 - 参照 KOOK 官方文档 */
  private handleSignal(msg: any): void {
    const sn = msg.sn;
    if (typeof sn === 'number' && sn > this.lastSn) {
      this.lastSn = sn;
    }

    // s=1 HELLO 握手信号（连接后服务器主动推送）
    if (msg.s === S_HELLO) {
      this.handleHello(msg);
      return;
    }

    // s=0 事件信号
    if (msg.s === S_EVENT) {
      this.handleEvent(msg.d);
      return;
    }

    // s=3 心跳回复
    if (msg.s === S_HEARTBEAT_ACK) {
      // ignore
      return;
    }

    // s=5 服务端要求重连
    if (msg.s === S_RECONNECT) {
      this.logger.warn('KOOK server requests reconnect');
      this.reconnect();
      return;
    }

    // s=6 恢复成功
    if (msg.s === S_RESUME_ACK) {
      this.logger.log('KOOK session resumed');
      this.connected = true;
      this.emit('resume');
      return;
    }
  }

  /** 处理 HELLO 握手信号 */
  private handleHello(msg: any): void {
    const d = msg.d || {};
    const code = d.code !== undefined ? d.code : msg.code;
    
    if (code === 0) {
      const sessionId = d.sessionId || d.session_id || msg.session_id;
      if (sessionId) this.sessionId = sessionId;
      this.logger.log(`KOOK hello OK, session_id=${this.sessionId}`);

      // 握手成功即拿到机器人自身 ID（在 d.user 或 d.bot）
      const bot = d.user || d.bot || {};
      if (bot.id || bot.user_id) {
        this.botId = bot.id || bot.user_id;
        this.connected = true;
        this.reconnectAttempts = 0;
        this.logger.log(`KOOK bot ready: ${bot.username || '(unknown)'} (id=${this.botId})`);
        this.emit('ready', bot);
      } else {
        // KOOK 可能不在握手时返回 bot 信息，先标记已连接
        this.logger.log('KOOK hello OK, bot info not in HELLO (will get from events)');
        this.connected = true;
      }
    } else if (code !== undefined) {
      this.logger.error(`KOOK hello failed: code=${code}`);
    }
  }

  /** 处理事件（s=0） */
  private handleEvent(d: any): void {
    if (!d) return;

    // 系统事件：type=255
    if (d.type === 255) {
      // 按钮点击事件的 event_type 在 extra.type，普通消息在 d.event_type
      const eventType = d.event_type || d.extra?.type;
      this.logger.debug(`KOOK system event: ${eventType}`);

      // event_type='message' 消息事件
      // KOOK 协议：msg_id 才是消息唯一 ID，not d.id
      if (eventType === 'message') {
        const msgId = d.msg_id || d.id || '';
        this.emit('message', { ...(d as KookMessageEvent), id: msgId });
        return;
      }

      // 卡片按钮点击回调（return-val），数据在 extra.body 中
      if (eventType === 'message_btn_click') {
        const body = d.extra?.body || {};
        const ev: KookButtonClickEvent = {
          msgId: body.msg_id || d.msg_id || '',
          userId: body.user_id || '',
          username: body.user_info?.username || '',
          targetId: body.target_id || d.target_id || '',
          guildId: d.extra?.guild_id || d.guild_id || '',
          value: body.value || '',
        };
        this.emit('button_click', ev);
        return;
      }

      return;
    }

    // type=9 消息事件（部分实现用此方式）
    if (d.type === 9) {
      const msgId = d.msg_id || d.id || '';
      this.emit('message', { ...(d as KookMessageEvent), id: msgId });
      return;
    }

    this.logger.debug(`KOOK unhandled: type=${d.type}, event_type=${d.event_type}`);
  }

  /** 启动心跳 - 参照 khl.py receiver.heartbeat */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      // khl.py 发送 {s: 2, sn: <last_sn>}
      this.send({ s: S_HEARTBEAT, sn: this.lastSn });
    }, HEARTBEAT_INTERVAL_MS);
    this.logger.log(`KOOK heartbeat started: ${HEARTBEAT_INTERVAL_MS}ms`);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private reconnect(): void {
    this.cleanup();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`KOOK max reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000);
    this.logger.warn(`KOOK reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        const gatewayUrl = await this.getGatewayUrl();
        if (gatewayUrl) {
          await this.connect(gatewayUrl);
        } else {
          this.scheduleReconnect();
        }
      } catch (err: any) {
        this.logger.error(`KOOK reconnect failed: ${err.message}`);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.connected = false;
  }
}
