import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomBytes, randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '../config/config.service';
import { AgoraService } from '../agora/agora.service';
import { EventBusService } from '../events/events.service';
import {
  SESSIONS_FILE,
  SessionStatus,
  ShareSession,
  SessionInfo,
  StoredSessions,
} from './session.types';
import { getQualityInfo } from '../config/config.types';

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private sessions = new Map<string, ShareSession>();
  private tokenIndex = new Map<string, string>();

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly agora: AgoraService,
    private readonly bus: EventBusService,
  ) {}

  async onModuleInit() {
    const data = await this.storage.readJson<StoredSessions>(SESSIONS_FILE, {
      sessions: [],
    });
    for (const s of data.sessions) {
      // 服务器重启后不再强制结束所有 session，而是让 watchdog 自然处理：
      // - ACTIVE 的 session 心跳已超时，watchdog 会先进入 GRACE 再超时结束
      // - PENDING 的 session 仍可用，直到 idleTimeoutSec 超时
      // - GRACE 的 session 继续倒计时
      // 这样服务器重启（如 Docker 重建）不会立即让所有链接失效

      // 兼容旧数据：补齐新字段
      if (s.peakViewers === undefined) s.peakViewers = s.viewerCount || 0;
      if (s.totalViewerJoins === undefined) s.totalViewerJoins = 0;
      if (s.durationMs === undefined) s.durationMs = null;
      if (s.graceStartedAt === undefined) s.graceStartedAt = null;
      if (s.graceReason === undefined) s.graceReason = null;
      if (s.lastViewerAt === undefined) s.lastViewerAt = null;
      if (!s.quality) s.quality = '1080p30';
      this.sessions.set(s.id, s);
      this.tokenIndex.set(s.token, s.id);
    }
    await this.persist();
    this.logger.log('loaded ' + this.sessions.size + ' sessions');
  }

  createSession(params: {
    sharerUserId: string;
    sharerUsername: string;
    guildId: string;
    targetChannelId: string;
    manualCreated?: boolean;
    quality?: string;
  }): ShareSession {
    const id = randomUUID();
    const shortId = id.replace(/-/g, '').slice(0, 12);
    const token = randomBytes(32).toString('hex');
    const now = Date.now();

    const session: ShareSession = {
      id,
      token,
      channel: this.agora.generateChannelName(shortId),
      sharerUserId: params.sharerUserId,
      sharerUsername: params.sharerUsername,
      guildId: params.guildId,
      targetChannelId: params.targetChannelId,
      status: SessionStatus.PENDING,
      viewerCount: 0,
      peakViewers: 0,
      totalViewerJoins: 0,
      quality: params.quality || '1080p30',
      manualCreated: params.manualCreated || false,
      createdAt: now,
      startedAt: null,
      endedAt: null,
      durationMs: null,
      lastHeartbeat: now,
      graceStartedAt: null,
      graceReason: null,
      lastViewerAt: null,
    };

    this.sessions.set(id, session);
    this.tokenIndex.set(token, id);
    void this.persist();
    return session;
  }

  getByToken(token: string): ShareSession | undefined {
    const id = this.tokenIndex.get(token);
    if (!id) return undefined;
    return this.sessions.get(id);
  }

  getById(id: string): ShareSession | undefined {
    return this.sessions.get(id);
  }

  /** 检查用户是否有活跃的共享会话（非 ENDED 状态） */
  hasActiveSession(sharerUserId: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.sharerUserId === sharerUserId && session.status !== SessionStatus.ENDED) {
        return true;
      }
    }
    return false;
  }

  listAll(): ShareSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  startSharing(token: string, clientId?: string): ShareSession | undefined {
    const session = this.getByToken(token);
    if (!session || session.status === SessionStatus.ENDED) {
      this.logger.warn(`startSharing: session not found or ended, token=${token.substring(0, 8)}...`);
      return undefined;
    }

    // 需求1: 一个链接只有第一个点开的人能共享
    // 如果已有 publisherClientId 且不匹配，拒绝
    if (session.publisherClientId && clientId && session.publisherClientId !== clientId) {
      this.logger.warn(
        `startSharing: rejected, publisher locked to ${session.publisherClientId.substring(0, 8)}..., got ${clientId.substring(0, 8)}...`,
      );
      return undefined;
    }
    // 第一个开始共享的人锁定 publisherClientId
    if (!session.publisherClientId && clientId) {
      session.publisherClientId = clientId;
    }

    const wasGrace = session.status === SessionStatus.GRACE;
    session.status = SessionStatus.ACTIVE;
    session.lastHeartbeat = Date.now();
    session.graceStartedAt = null;
    session.graceReason = null;
    // 开始/恢复共享时重置无人观看计时（待观众数变 0 再开始计时）
    session.lastViewerAt = Date.now();
    if (!session.startedAt) {
      session.startedAt = Date.now();
    }
    void this.persist();

    this.logger.log(
      `startSharing: session=${session.id}, wasGrace=${wasGrace}, cardMessageId=${session.cardMessageId || 'none'}, targetChannelId=${session.targetChannelId || 'empty'}`,
    );

    if (!wasGrace && !session.cardMessageId) {
      this.logger.log(`startSharing: emitting session.started event for ${session.id}`);
      this.bus.emitSessionStarted({
        sessionId: session.id,
        token: session.token,
        sharerUsername: session.sharerUsername,
        targetChannelId: session.targetChannelId,
        guildId: session.guildId,
      });
    } else {
      this.logger.log(`startSharing: skipping card push (wasGrace=${wasGrace}, cardMessageId exists=${!!session.cardMessageId})`);
    }
    return session;
  }

  heartbeat(token: string): boolean {
    const session = this.getByToken(token);
    if (!session || session.status === SessionStatus.ENDED) return false;
    session.lastHeartbeat = Date.now();
    // 仅在「心跳丢失」导致的 GRACE 下自动恢复；主动停止共享的 GRACE 需由分享者重新开共享
    if (
      session.status === SessionStatus.GRACE &&
      session.graceReason === 'heartbeat'
    ) {
      session.status = SessionStatus.ACTIVE;
      session.graceStartedAt = null;
      session.graceReason = null;
      this.logger.log('session ' + session.id + ' reconnected within grace');
    }
    return true;
  }

  /**
   * 停止共享：进入「恢复宽限期」而非立即结束。
   * 宽限期内原链接仍可重新开共享（分享者再次点击开始）或继续观看，
   * 直到持续 idleTimeoutSec 秒没有任何共享才真正结束。
   */
  stopSharing(token: string): ShareSession | undefined {
    const session = this.getByToken(token);
    if (!session || session.status === SessionStatus.ENDED) return undefined;
    const now = Date.now();
    session.status = SessionStatus.GRACE;
    session.graceReason = 'stopped';
    session.graceStartedAt = now;
    session.lastHeartbeat = now;
    void this.persist();
    this.logger.log(
      `stopSharing: session=${session.id} entered 'stopped' grace, idle timeout ${this.config.get().session.idleTimeoutSec}s`,
    );
    return session;
  }

  setCardMessageId(sessionId: string, messageId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cardMessageId = messageId;
      void this.persist();
    }
  }

  updateViewerCount(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.viewerCount = Math.max(0, count);
      if (count > session.peakViewers) {
        session.peakViewers = count;
      }
      // 无人观看自动结束计时：有观众则清除计时，无观众则开始计时（任何非ENDED状态）
      if (count > 0) {
        session.lastViewerAt = null;
      } else if (session.status !== SessionStatus.ENDED) {
        session.lastViewerAt = Date.now();
      }
    }
  }

  recordViewerJoin(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalViewerJoins++;
    }
  }

  updateQuality(sessionId: string, quality: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.quality = quality;
      void this.persist();
      this.logger.log(`session ${sessionId} quality set to ${quality}`);
    }
  }

  endSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === SessionStatus.ENDED) return;

    const ageMs = Date.now() - session.createdAt;
    session.status = SessionStatus.ENDED;
    session.endedAt = Date.now();
    // 计算共享时长（毫秒）
    if (session.startedAt) {
      session.durationMs = session.endedAt - session.startedAt;
    }
    void this.persist();

    this.bus.emitSessionEnded({
      sessionId: session.id,
      reason,
      targetChannelId: session.targetChannelId,
      cardMessageId: session.cardMessageId,
    });
    this.logger.warn(
      `session ${session.id} ENDED: reason=${reason}, age=${(ageMs / 1000).toFixed(1)}s, ` +
      `statusWas=${session.status}, startedAt=${session.startedAt ? 'yes' : 'no'}, ` +
      `duration=${session.durationMs}ms, peakViewers=${session.peakViewers}`,
    );
  }

  /** 删除已结束的 session 记录（仅允许删除 ENDED 状态，防止误删进行中的直播） */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.status !== SessionStatus.ENDED) return false;
    this.sessions.delete(sessionId);
    this.tokenIndex.delete(session.token);
    void this.persist();
    this.logger.log(`session ${sessionId} record deleted`);
    return true;
  }

  toInfo(session: ShareSession): SessionInfo {
    // 计算实时时长
    let durationMs = session.durationMs;
    if (session.startedAt && session.status !== SessionStatus.ENDED) {
      durationMs = Date.now() - session.startedAt;
    } else if (session.startedAt && session.endedAt) {
      durationMs = session.endedAt - session.startedAt;
    }

    // 声网标准时长计费（参照 https://doc.shengwang.cn/doc/rtc/android/billing/billing-strategy）
    // 标准时长 = 用量(秒) × 折算系数，结果向上取整到分钟
    const qi = getQualityInfo(session.quality);
    const durationSec = durationMs ? durationMs / 1000 : 0;
    const totalUsers = 1 + session.peakViewers; // 1 发布者 + 峰值观众

    // 视频标准秒数 = 总人数 × 时长 × 视频系数
    const videoStandardSec = totalUsers * durationSec * qi.coefficient;
    // 音频标准秒数 = 总人数 × 时长 × 1
    const audioStandardSec = totalUsers * durationSec * 1;
    // 合计标准分钟数（向上取整）
    const billingMinutes = durationMs
      ? Math.ceil((videoStandardSec + audioStandardSec) / 60)
      : 0;

    const durationMin = durationSec / 60;
    const billingDetail = durationMs
      ? `${durationMin.toFixed(1)}分 × ${totalUsers}人 × (${qi.coefficient}视频+1音频) = ${billingMinutes} 分钟`
      : '-';

    // 计算未共享屏幕倒计时剩余秒数（PENDING / GRACE 状态）
    let idleRemainingSec: number | undefined;
    if (session.status === SessionStatus.PENDING) {
      const idleCfg = this.config.get().session.idleTimeoutSec;
      const elapsed = (Date.now() - session.createdAt) / 1000;
      idleRemainingSec = Math.max(0, Math.ceil(idleCfg - elapsed));
    } else if (session.status === SessionStatus.GRACE && session.graceStartedAt) {
      const idleCfg = this.config.get().session.idleTimeoutSec;
      const elapsed = (Date.now() - session.graceStartedAt) / 1000;
      idleRemainingSec = Math.max(0, Math.ceil(idleCfg - elapsed));
    }

    // 计算无人观看自动结束剩余秒数（任何非 ENDED 状态，viewerCount=0）
    let noViewerRemainingSec: number | undefined;
    if (
      session.status !== SessionStatus.ENDED &&
      session.viewerCount === 0 &&
      session.lastViewerAt
    ) {
      const nvCfg = this.config.get().session.noViewerTimeoutSec;
      const elapsed = (Date.now() - session.lastViewerAt) / 1000;
      noViewerRemainingSec = Math.max(0, Math.ceil(nvCfg - elapsed));
    }

    return {
      id: session.id,
      channel: session.channel,
      sharerUsername: session.sharerUsername,
      status: session.status,
      viewerCount: session.viewerCount,
      peakViewers: session.peakViewers,
      totalViewerJoins: session.totalViewerJoins,
      quality: session.quality,
      shareLink: this.config.buildShareLink(session.token),
      viewLink: this.config.buildViewLink(session.token),
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs,
      billingMinutes,
      billingDetail,
      publisherClientId: session.publisherClientId,
      idleRemainingSec,
      noViewerRemainingSec,
    };
  }

  @Interval(5000)
  async watchdog() {
    const cfg = this.config.get().session;
    const now = Date.now();

    for (const session of this.sessions.values()) {
      if (session.status === SessionStatus.ENDED) continue;

      // === 无人观看倒计时（任何非 ENDED 状态） ===
      if (
        session.viewerCount === 0 &&
        session.lastViewerAt &&
        now - session.lastViewerAt > cfg.noViewerTimeoutSec * 1000
      ) {
        this.endSession(session.id, 'no_viewer_timeout');
        continue;
      }

      // === 未共享屏幕倒计时 ===

      // PENDING 状态：等待开始共享
      if (session.status === SessionStatus.PENDING) {
        if (now - session.createdAt > cfg.idleTimeoutSec * 1000) {
          this.endSession(session.id, 'idle_timeout');
        }
        continue;
      }

      // ACTIVE 状态：心跳丢失 → 进入 GRACE
      if (session.status === SessionStatus.ACTIVE) {
        const elapsed = now - session.lastHeartbeat;
        if (elapsed > cfg.heartbeatIntervalSec * 1000 * 3) {
          session.status = SessionStatus.GRACE;
          session.graceReason = 'heartbeat';
          session.graceStartedAt = now;
          this.logger.warn(
            'session ' + session.id + ' heartbeat lost, entering grace',
          );
          this.bus.emitSessionStateChanged({
            sessionId: session.id,
            status: session.status,
            viewerCount: session.viewerCount,
          });
        }
        continue;
      }

      // GRACE 状态：统一使用 idleTimeoutSec
      if (session.status === SessionStatus.GRACE && session.graceStartedAt) {
        if (now - session.graceStartedAt > cfg.idleTimeoutSec * 1000) {
          this.endSession(session.id, 'idle_timeout');
          continue;
        }
      }
    }
  }

  private async persist(): Promise<void> {
    const data: StoredSessions = { sessions: Array.from(this.sessions.values()) };
    await this.storage.writeJson(SESSIONS_FILE, data);
  }
}
