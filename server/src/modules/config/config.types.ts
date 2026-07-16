export interface AppConfig {
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
    /** 停止共享后的恢复宽限期（秒）：宽限期内原链接仍可重新开共享 / 观看 */
    shareStopGraceSec: number;
    /** 无人观看持续多少秒后自动结束直播（节省计费） */
    noViewerTimeoutSec: number;
  };
  admin: {
    passwordHash: string;
  };
  server: {
    publicDomain: string;
  };
}

export const CONFIG_FILE = 'config.json';

/** 画质选项及声网计费系数（参照 https://doc.shengwang.cn/doc/rtc/android/billing/billing-strategy） */
export interface QualityInfo {
  key: string;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  bitrateMin: number;
  bitrateMax: number;
  resolution: number;
  tier: string;
  coefficient: number;
}

export const QUALITY_PRESETS: QualityInfo[] = [
  {
    key: '540p30',
    label: '540P 30fps',
    width: 960, height: 540, frameRate: 30, bitrateMin: 500, bitrateMax: 1500,
    resolution: 960 * 540, tier: 'HD 高清', coefficient: 4,
  },
  {
    key: '720p30',
    label: '720P 30fps',
    width: 1280, height: 720, frameRate: 30, bitrateMin: 1000, bitrateMax: 3000,
    resolution: 1280 * 720, tier: 'HD 高清', coefficient: 4,
  },
  {
    key: '1080p30',
    label: '1080P 30fps',
    width: 1920, height: 1080, frameRate: 30, bitrateMin: 2000, bitrateMax: 5000,
    resolution: 1920 * 1080, tier: 'Full HD 全高清', coefficient: 9,
  },
  {
    key: '1080p60',
    label: '1080P 60fps',
    width: 1920, height: 1080, frameRate: 60, bitrateMin: 3000, bitrateMax: 8000,
    resolution: 1920 * 1080, tier: 'Full HD 全高清', coefficient: 9,
  },
  {
    key: '1440p30',
    label: '1440P 30fps',
    width: 2560, height: 1440, frameRate: 30, bitrateMin: 4000, bitrateMax: 10000,
    resolution: 2560 * 1440, tier: '2K', coefficient: 16,
  },
  {
    key: '1440p60',
    label: '1440P 60fps',
    width: 2560, height: 1440, frameRate: 60, bitrateMin: 6000, bitrateMax: 15000,
    resolution: 2560 * 1440, tier: '2K', coefficient: 16,
  },
  {
    key: '4k30',
    label: '4K 30fps',
    width: 3840, height: 2160, frameRate: 30, bitrateMin: 8000, bitrateMax: 20000,
    resolution: 3840 * 2160, tier: '2K+ 超高清', coefficient: 36,
  },
];

export function getQualityInfo(key: string): QualityInfo {
  return QUALITY_PRESETS.find((q) => q.key === key) || QUALITY_PRESETS[2];
}

export const DEFAULT_CONFIG: AppConfig = {
  agora: {
    appId: '',
    appCertificate: '',
    tokenExpireSec: 3600,
    allowedQualities: ['540p30', '720p30', '1080p30', '1080p60', '1440p30', '1440p60', '4k30'],
  },
  kook: {
    botToken: '',
    triggerWords: '屏幕共享,共享屏幕',
  },
  session: {
    gracePeriodSec: 30,
    noPublisherTimeoutSec: 60,
    heartbeatIntervalSec: 5,
    shareStopGraceSec: 60,
    noViewerTimeoutSec: 180,
  },
  admin: {
    passwordHash: '',
  },
  server: {
    publicDomain: 'http://localhost:3520',
  },
};
