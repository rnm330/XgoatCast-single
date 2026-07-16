import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { api } from '../lib/api';

const AgoraRTC = (window as any).AgoraRTC;
AgoraRTC.setLogLevel(2);

export interface ViewerState {
  joined: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  error: string;
}

export function useAgoraView(token: string, active: boolean) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoRef = useRef<IRemoteVideoTrack | null>(null);
  const audioRef = useRef<IRemoteAudioTrack | null>(null);
  // 专门用于 Agora play() 的容器，与 React 管理的 DOM 隔离
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ViewerState>({
    joined: false,
    hasVideo: false,
    hasAudio: false,
    error: '',
  });

  /** 注册播放器容器（由 ViewPage 通过 ref callback 传入专用 div） */
  const setPlayerContainer = useCallback((el: HTMLDivElement | null) => {
    playerContainerRef.current = el;
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const join = async () => {
      try {
        const tokenResp = await api.getShareToken(token, 'subscriber');
        if (cancelled) return;
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        // 严格按 Agora 官方示例
        client.on('user-published', async (user: any, mediaType: 'video' | 'audio') => {
          try {
            await client.subscribe(user, mediaType);
            if (cancelled) return;

            if (mediaType === 'video') {
              videoRef.current = user.videoTrack;
              // 在专用容器中播放（不触碰 React 管理的 DOM）
              // fit: 'contain' 完整显示屏幕内容，避免边缘被裁切
              if (playerContainerRef.current) {
                user.videoTrack.play(playerContainerRef.current, { fit: 'contain' });
              }
              setState((s) => ({ ...s, hasVideo: true }));
            }

            if (mediaType === 'audio') {
              audioRef.current = user.audioTrack;
              audioRef.current?.play();
              setState((s) => ({ ...s, hasAudio: true }));
            }
          } catch (e) {
            console.error('subscribe error', e);
          }
        });

        client.on('user-unpublished', (user: any, mediaType: 'video' | 'audio') => {
          if (mediaType === 'video') {
            // 停止播放并移除 Agora 在容器中创建的 <video> 元素，
            // 否则分享者暂停/停止发布后画面中央会残留原生播放器占位图标
            try { user?.videoTrack?.stop(); } catch {}
            videoRef.current = null;
            setState((s) => ({ ...s, hasVideo: false }));
          }
          if (mediaType === 'audio') {
            try { user?.audioTrack?.stop(); } catch {}
            audioRef.current = null;
            setState((s) => ({ ...s, hasAudio: false }));
          }
        });

        await client.join(
          tokenResp.appId,
          tokenResp.channel,
          tokenResp.token || null,
          tokenResp.uid,
        );
        if (cancelled) return;
        setState((s) => ({ ...s, joined: true }));
      } catch (e: any) {
        if (!cancelled) {
          setState((s) => ({ ...s, error: e?.message || String(e) }));
        }
      }
    };

    join();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      if (client) {
        client.leave().catch(() => {});
      }
      clientRef.current = null;
      videoRef.current = null;
      audioRef.current = null;
    };
  }, [token, active]);

  const setAudioMuted = useCallback((muted: boolean) => {
    audioRef.current?.setVolume(muted ? 0 : 100);
  }, []);

  return { ...state, setPlayerContainer, setAudioMuted };
}
