import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SessionService } from '../session/session.service';
import { AuthService } from '../auth/auth.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  LoginDto,
  UpdatePasswordDto,
  UpdateConfigDto,
  ManualShareDto,
} from './admin.dto';

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly auth: AuthService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const xff = req.headers?.['x-forwarded-for'];
    const ip =
      (typeof xff === 'string' ? xff.split(',')[0].trim() : '') ||
      req.ip ||
      'unknown';

    const state = this.auth.getLoginState(ip);
    if (!state.allowed) {
      return {
        ok: false,
        locked: true,
        retryAfter: state.retryAfterSec,
        message: `尝试次数过多，请 ${state.retryAfterSec} 秒后再试`,
      };
    }

    if (!this.auth.verifyPassword(dto.password)) {
      const after = this.auth.recordLoginFailure(ip);
      if (after.locked) {
        return {
          ok: false,
          locked: true,
          retryAfter: after.retryAfterSec,
          message: `密码错误次数过多，请 ${after.retryAfterSec} 秒后再试`,
        };
      }
      return {
        ok: false,
        message: `密码错误，剩余 ${after.remaining} 次尝试机会`,
        remaining: after.remaining,
      };
    }

    this.auth.recordLoginSuccess(ip);
    return { ok: true, token: this.auth.signAdminToken() };
  }

  @Get('config')
  @UseGuards(AdminGuard)
  getConfig() {
    const cfg = this.config.get();
    return {
      agora: {
        appId: cfg.agora.appId,
        appCertificate: cfg.agora.appCertificate ? '******' : '',
        tokenExpireSec: cfg.agora.tokenExpireSec,
        allowedQualities: cfg.agora.allowedQualities,
      },
      kook: {
        botToken: cfg.kook.botToken ? '******' : '',
        triggerWords: cfg.kook.triggerWords,
      },
      session: cfg.session,
      server: cfg.server,
    };
  }

  @Put('config')
  @UseGuards(AdminGuard)
  async updateConfig(@Body() dto: UpdateConfigDto) {
    const current = this.config.get();
    if (dto.agora && dto.agora.appCertificate === '******') {
      dto.agora.appCertificate = current.agora.appCertificate;
    }
    if (dto.kook && dto.kook.botToken === '******') {
      dto.kook.botToken = current.kook.botToken;
    }
    const updated = await this.config.update(dto as any);
    return { ok: true, config: updated };
  }

  @Put('password')
  @UseGuards(AdminGuard)
  async updatePassword(@Body() dto: UpdatePasswordDto) {
    if (!this.auth.verifyPassword(dto.oldPassword)) {
      return { ok: false, message: '原密码错误' };
    }
    await this.config.setAdminPassword(dto.newPassword);
    return { ok: true };
  }

  @Get('sessions')
  @UseGuards(AdminGuard)
  listSessions() {
    return this.sessionService
      .listAll()
      .map((s) => this.sessionService.toInfo(s));
  }

  @Post('sessions/manual')
  @UseGuards(AdminGuard)
  createManual(@Body() dto: ManualShareDto) {
    const session = this.sessionService.createSession({
      sharerUserId: dto.sharerUserId,
      sharerUsername: dto.sharerUsername,
      guildId: dto.guildId || 'manual',
      targetChannelId: dto.targetChannelId || '',
      manualCreated: true,
    });
    return this.sessionService.toInfo(session);
  }

  @Delete('sessions/:id')
  @UseGuards(AdminGuard)
  endSession(@Param('id') id: string) {
    this.sessionService.endSession(id, 'admin_force_end');
    return { ok: true };
  }

  @Delete('sessions/:id/record')
  @UseGuards(AdminGuard)
  deleteSessionRecord(@Param('id') id: string) {
    const ok = this.sessionService.deleteSession(id);
    return { ok };
  }
}
