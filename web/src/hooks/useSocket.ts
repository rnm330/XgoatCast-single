import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SessionStatus } from '../types';

interface SocketState {
  connected: boolean;
  status: SessionStatus | null;
  viewerCount: number;
  ended: boolean;
  publisherClientId?: string;
  graceRemainingSec?: number;
  noViewerRemainingSec?: number;
}

const HEARTBEAT_INTERVAL_MS = 4000;

export function useSocket(token: string, role: 'publisher' | 'viewer') {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    connected: false,
    status: null,
    viewerCount: 0,
    ended: false,
  });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = io({
      query: { t: token, role },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    const startHeartbeat = () => {
      if (role !== 'publisher') return;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat', { token });
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true }));
      startHeartbeat();
    });
    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
      stopHeartbeat();
    });
    socket.on('connect_error', (err: Error) => {
      console.error('socket connect error:', err.message);
    });
    socket.on('session_state', (data: {
      status: SessionStatus;
      viewerCount: number;
      publisherClientId?: string;
      graceRemainingSec?: number;
      noViewerRemainingSec?: number;
    }) => {
      setState((s) => ({
        ...s,
        status: data.status,
        viewerCount: data.viewerCount,
        publisherClientId: data.publisherClientId,
        graceRemainingSec: data.graceRemainingSec,
        noViewerRemainingSec: data.noViewerRemainingSec,
      }));
    });
    socket.on('viewer_count', (data: { count: number }) => {
      setState((s) => ({ ...s, viewerCount: data.count }));
    });
    socket.on('session_ended', () => {
      setState((s) => ({ ...s, ended: true, status: 'ended' }));
    });
    socket.on('session_error', (data: { message: string }) => {
      console.error('session error:', data.message);
      setState((s) => ({ ...s, ended: true, status: 'ended', connected: false }));
      stopHeartbeat();
    });

    return () => {
      stopHeartbeat();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, role]);

  const emitSharingStarted = useCallback(
    (quality?: string, clientId?: string, ack?: (resp: { ok: boolean }) => void) => {
      if (!socketRef.current?.connected) {
        console.warn('emitSharingStarted: socket not connected');
        ack?.({ ok: false });
        return;
      }
      socketRef.current.emit(
        'sharing_started',
        { token, quality, clientId },
        (resp: { ok: boolean }) => {
          console.log('sharing_started ack:', resp);
          ack?.(resp);
        },
      );
    },
    [token],
  );

  const emitSharingStopped = useCallback(() => {
    socketRef.current?.emit('sharing_stopped', { token });
  }, [token]);

  return { ...state, emitSharingStarted, emitSharingStopped };
}
