export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  GRACE = 'grace',
  ENDED = 'ended',
}

/** GRACE 状态的原因：心跳丢失 / 主动停止共享 */
export type GraceReason = 'heartbeat' | 'stopped' | null;

export interface ShareSession {
  id: string;
  token: string;
  channel: string;
  sharerUserId: string;
  sharerUsername: string;
  guildId: string;
  targetChannelId: string;
  status: SessionStatus;
  viewerCount: number;
  peakViewers: number;
  totalViewerJoins: number;
  quality: string;
  cardMessageId?: string;
  manualCreated: boolean;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  lastHeartbeat: number;
  /** 进入 GRACE 状态的时间戳（用于计算恢复宽限） */
  graceStartedAt: number | null;
  /** GRACE 状态的原因 */
  graceReason: GraceReason;
  /** 最后一次有观众的时间戳（用于无人观看自动结束，null 表示暂不计时） */
  lastViewerAt: number | null;
  /** 第一个点击开始共享的客户端 ID（只有此人可恢复共享） */
  publisherClientId?: string;
}

export interface SessionInfo {
  id: string;
  channel: string;
  sharerUsername: string;
  status: SessionStatus;
  viewerCount: number;
  peakViewers: number;
  totalViewerJoins: number;
  quality: string;
  shareLink: string;
  viewLink: string;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  /** 声网标准计费分钟数 */
  billingMinutes: number;
  /** 计费明细 */
  billingDetail: string;
  /** 已锁定的共享者客户端 ID */
  publisherClientId?: string;
  /** 未共享屏幕倒计时剩余秒数（PENDING / GRACE 状态） */
  idleRemainingSec?: number;
  /** 无人观看自动结束剩余秒数 */
  noViewerRemainingSec?: number;
}

export interface StoredSessions {
  sessions: ShareSession[];
}

export const SESSIONS_FILE = 'sessions.json';
