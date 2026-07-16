export type SessionStatus = 'pending' | 'active' | 'grace' | 'ended';

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
  billingMinutes: number;
  billingDetail: string;
  allowedQualities?: string[];
  publisherClientId?: string;
  graceRemainingSec?: number;
  noViewerRemainingSec?: number;
}

export interface AgoraTokenResponse {
  token: string;
  channel: string;
  uid: number;
  appId: string;
  expireSec: number;
}

export interface AdminConfig {
  agora: {
    appId: string;
    appCertificate: string;
    tokenExpireSec: number;
    allowedQualities: string[];
  };
  kook: {
    botToken: string;
    triggerWords: string;
  };
  session: {
    gracePeriodSec: number;
    noPublisherTimeoutSec: number;
    heartbeatIntervalSec: number;
    shareStopGraceSec: number;
    noViewerTimeoutSec: number;
  };
  server: {
    publicDomain: string;
  };
}

export interface ShareSettings {
  enableMic: boolean;
  enableCamera: boolean;
}
