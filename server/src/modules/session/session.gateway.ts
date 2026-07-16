import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SessionService } from './session.service';
import { EventBusService } from '../events/events.service';
import { ShareSession } from './session.types';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class SessionGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(SessionGateway.name);

  @WebSocketServer()
  server: Server;

  private clients = new Map<
    string,
    { token: string; role: string; sessionId: string }
  >();

  constructor(
    private readonly sessionService: SessionService,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit() {
    this.bus.onSessionEnded((event) => {
      this.broadcastSessionEnded(event.sessionId);
    });
    this.bus.onSessionStateChanged((event) => {
      const session = this.sessionService.getById(event.sessionId);
      if (session) {
        this.server.to(event.sessionId).emit('session_state', this.buildState(session));
      }
    });
  }

  /** 构建 session_state 事件数据，包含 grace 剩余时间和共享者信息 */
  private buildState(session: ShareSession) {
    const info = this.sessionService.toInfo(session);
    return {
      status: session.status,
      viewerCount: session.viewerCount,
      publisherClientId: session.publisherClientId,
      graceRemainingSec: info.graceRemainingSec,
      noViewerRemainingSec: info.noViewerRemainingSec,
    };
  }

  handleConnection(client: Socket) {
    const token = client.handshake.query['t'] as string;
    const role = (client.handshake.query['role'] as string) || 'viewer';
    if (!token) {
      client.emit('session_error', { message: 'missing token' });
      client.disconnect();
      return;
    }
    const session = this.sessionService.getByToken(token);
    if (!session) {
      this.logger.warn(`connection rejected: token not found, role=${role}`);
      client.emit('session_error', { message: 'invalid or expired link' });
      client.disconnect();
      return;
    }
    if (session.status === 'ended') {
      this.logger.warn(
        `connection rejected: session ${session.id} ended, role=${role}`,
      );
      client.emit('session_error', { message: 'share ended' });
      client.disconnect();
      return;
    }
    this.logger.log(
      `client connected: session=${session.id}, status=${session.status}, role=${role}`,
    );
    this.clients.set(client.id, { token, role, sessionId: session.id });

    if (role === 'viewer') {
      const viewers = this.countViewers(session.id);
      this.sessionService.updateViewerCount(session.id, viewers);
      this.sessionService.recordViewerJoin(session.id);
      this.server.to(session.id).emit('viewer_count', { count: viewers });
      // 发送session_state以更新noViewerRemainingSec
      this.server.to(session.id).emit('session_state', this.buildState(session));
    }
    client.join(session.id);
    client.emit('session_state', this.buildState(session));
  }

  handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    this.clients.delete(client.id);
    if (info && info.role === 'viewer') {
      const viewers = this.countViewers(info.sessionId);
      this.sessionService.updateViewerCount(info.sessionId, viewers);
      this.server.to(info.sessionId).emit('viewer_count', { count: viewers });
      // 发送session_state以更新noViewerRemainingSec
      const session = this.sessionService.getById(info.sessionId);
      if (session) {
        this.server.to(info.sessionId).emit('session_state', this.buildState(session));
      }
    }
  }

  @SubscribeMessage('sharing_started')
  handleSharingStarted(
    @MessageBody() body: { token: string; quality?: string; clientId?: string },
  ) {
    this.logger.log(
      `sharing_started received: token=${body.token.substring(0, 8)}..., quality=${body.quality || 'none'}, clientId=${body.clientId?.substring(0, 8) || 'none'}`,
    );
    const session = this.sessionService.startSharing(body.token, body.clientId);
    if (session && body.quality) {
      this.sessionService.updateQuality(session.id, body.quality);
    }
    if (session) {
      this.logger.log(`sharing_started OK: session=${session.id}, status=${session.status}`);
      this.server.to(session.id).emit('session_state', this.buildState(session));
    } else {
      this.logger.warn(`sharing_started FAILED: session not found, ended, or publisher locked`);
    }
    return { ok: !!session };
  }

  @SubscribeMessage('sharing_stopped')
  handleSharingStopped(@MessageBody() body: { token: string }) {
    const session = this.sessionService.stopSharing(body.token);
    if (session) {
      this.server.to(session.id).emit('session_state', this.buildState(session));
    }
    return { ok: !!session };
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@MessageBody() body: { token: string }) {
    const ok = this.sessionService.heartbeat(body.token);
    this.logger.debug(`heartbeat received: ok=${ok}, token=${body.token?.substring(0, 8)}...`);
    return { ok };
  }

  broadcastSessionEnded(sessionId: string) {
    this.server.to(sessionId).emit('session_ended', { sessionId });
  }

  private countViewers(sessionId: string): number {
    let count = 0;
    for (const info of this.clients.values()) {
      if (info.sessionId === sessionId && info.role === 'viewer') count++;
    }
    return count;
  }
}
