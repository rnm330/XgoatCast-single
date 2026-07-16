import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ILocalVideoTrack,
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng';
import { api } from '../lib/api';

const AgoraRTC = (window as any).AgoraRTC;
AgoraRTC.setLogLevel(2);

export interface PublishResult {
  success: boolean;
  message?: string;
}

export interface QualityOption {
  key: string;
  label: string;
  encoderConfig: {
    width: number;
    height: number;
    frameRate: number;
    bitrateMin: number;
    bitrateMax: number;
  };
}

/** 7 种画质选项，与后端 QUALITY_PRESETS 对应 */
export const QUALITY_OPTIONS: QualityOption[] = [
  {
    key: '540p30',
    label: '540P 30fps',
    encoderConfig: { width: 960, height: 540, frameRate: 30, bitrateMin: 500, bitrateMax: 1500 },
  },
  {
    key: '720p30',
    label: '720P 30fps',
    encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 1000, bitrateMax: 3000 },
  },
  {
    key: '1080p30',
    label: '1080P 30fps',
    encoderConfig: { width: 1920, height: 1080, frameRate: 30, bitrateMin: 2000, bitrateMax: 5000 },
  },
  {
    key: '1080p60',
    label: '1080P 60fps',
    encoderConfig: { width: 1920, height: 1080, frameRate: 60, bitrateMin: 3000, bitrateMax: 8000 },
  },
  {
    key: '1440p30',
    label: '1440P 30fps',
    encoderConfig: { width: 2560, height: 1440, frameRate: 30, bitrateMin: 4000, bitrateMax: 10000 },
  },
  {
    key: '1440p60',
    label: '1440P 60fps',
    encoderConfig: { width: 2560, height: 1440, frameRate: 60, bitrateMin: 6000, bitrateMax: 15000 },
  },
  {
    key: '4k30',
    label: '4K 30fps',
    encoderConfig: { width: 3840, height: 2160, frameRate: 30, bitrateMin: 8000, bitrateMax: 20000 },
  },
];

export function useScreenShare(token: string, onTrackEnded?: () => void) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const screenVideoRef = useRef<ILocalVideoTrack | null>(null);
  const screenAudioRef = useRef<ILocalAudioTrack | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const onTrackEndedRef = useRef(onTrackEnded);
  onTrackEndedRef.current = onTrackEnded;
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string>('');
  // 本地预览容器（分享者查看自己的画面，不走声网）
  const localPreviewRef = useRef<HTMLDivElement | null>(null);

  const setLocalPreviewContainer = useCallback((el: HTMLDivElement | null) => {
    localPreviewRef.current = el;
  }, []);

  // 本地预览：当 isSharing 变为 true 且容器已挂载后，播放本地屏幕轨道
  useEffect(() => {
    if (isSharing && localPreviewRef.current && screenVideoRef.current) {
      screenVideoRef.current.play(localPreviewRef.current, { fit: 'contain' });
    }
  }, [isSharing]);

  const publish = useCallback(
    async (opts: {
      enableMic: boolean;
      enableCamera: boolean;
      qualityKey?: string;
    }) => {
      setError('');
      try {
        if (!(window as any).AgoraRTC) {
          throw new Error('Agora SDK 未加载，请检查网络连接');
        }

        // 1. 先获取 token（不连接服务器）
        const tokenResp = await api.getShareToken(token, 'publisher');

        // 2. 先创建屏幕共享轨道（用户选择窗口）
        const qKey = opts.qualityKey || '1080p30';
        const qOpt = QUALITY_OPTIONS.find((q) => q.key === qKey) || QUALITY_OPTIONS[2];
        const screenTrack = await AgoraRTC.createScreenVideoTrack(
          { 
            encoderConfig: qOpt.encoderConfig,
            optimizationMode: 'detail',  // 屏幕共享优先清晰度
          },
          'auto',
        );

        if (Array.isArray(screenTrack)) {
          screenVideoRef.current = screenTrack[0];
          screenAudioRef.current = screenTrack[1];
        } else {
          screenVideoRef.current = screenTrack as ILocalVideoTrack;
        }

        const tracks: (ILocalVideoTrack | ILocalAudioTrack)[] = [
          screenVideoRef.current,
        ];
        if (screenAudioRef.current) tracks.push(screenAudioRef.current);

        if (opts.enableMic) {
          micRef.current = await AgoraRTC.createMicrophoneAudioTrack();
          tracks.push(micRef.current);
        }
        if (opts.enableCamera) {
          camRef.current = await AgoraRTC.createCameraVideoTrack();
          tracks.push(camRef.current);
        }

        // 3. 用户已选择窗口，现在连接服务器
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;
        await client.join(
          tokenResp.appId,
          tokenResp.channel,
          tokenResp.token || null,
          tokenResp.uid,
        );

        // 4. 发布轨道
        await client.publish(tracks);
        screenVideoRef.current?.on('track-ended', () => {
          // track 意外结束（用户通过浏览器原生 UI 停止、或高分辨率导致资源不足）
          // 通知父组件发送 sharing_stopped，让 session 进入 60 秒恢复宽限期
          stop();
          onTrackEndedRef.current?.();
        });
        setIsSharing(true);
        return { success: true };
      } catch (e: any) {
        // 失败时清理已创建的 Agora 资源，避免泄漏
        await stop();
        let msg = e?.message || String(e);
        // 尝试解析 JSON 格式的错误消息（如 401 share ended）
        try {
          const parsed = JSON.parse(msg);
          if (parsed.message) msg = parsed.message;
        } catch {}
        if (msg.includes('PERMISSION_DENIED') || msg.includes('NotAllowedError')) {
          if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            msg = '屏幕采集需要 HTTPS 环境才能使用。请通过 https:// 域名访问本页面，当前是 ' + location.protocol + '//' + location.host;
          } else {
            msg = '浏览器拒绝了屏幕采集权限，请在弹窗中点击「允许」并选择要共享的窗口/屏幕';
          }
        } else if (msg.includes('share ended') || msg.includes('Unauthorized')) {
          msg = '共享链接已失效（可能因服务器重启或超时），请重新发起共享';
        }
        setError(msg);
        return { success: false, message: msg };
      }
    },
    [token],
  );

  const stop = useCallback(async () => {
    const client = clientRef.current;
    try {
      screenVideoRef.current?.stop();
      screenAudioRef.current?.stop();
      micRef.current?.stop();
      camRef.current?.stop();
      if (client) await client.leave();
    } catch (e) {
      console.error('leave error', e);
    }
    screenVideoRef.current = null;
    screenAudioRef.current = null;
    micRef.current = null;
    camRef.current = null;
    clientRef.current = null;
    setIsSharing(false);
  }, []);

  return { isSharing, error, publish, stop, setLocalPreviewContainer };
}
