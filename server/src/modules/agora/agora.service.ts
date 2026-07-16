import { Injectable, Logger } from '@nestjs/common';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { ConfigService } from '../config/config.service';
import { AgoraRole, AgoraTokenResponse } from './agora.types';

@Injectable()
export class AgoraService {
  private readonly logger = new Logger(AgoraService.name);

  constructor(private readonly config: ConfigService) {}

  generateChannelName(sessionShortId: string): string {
    return 'xc_' + sessionShortId;
  }

  generateToken(channel: string, uid: number, role: AgoraRole): AgoraTokenResponse {
    const cfg = this.config.get();
    const appId = cfg.agora.appId;
    const cert = cfg.agora.appCertificate;
    const expireSec = cfg.agora.tokenExpireSec;

    if (!appId || !cert) {
      this.logger.warn('Agora App ID or Certificate not configured');
    }

    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const token = appId && cert
      ? RtcTokenBuilder.buildTokenWithUid(appId, cert, channel, uid, rtcRole, expireSec, expireSec)
      : '';

    return { token, channel, uid, appId, expireSec };
  }
}
