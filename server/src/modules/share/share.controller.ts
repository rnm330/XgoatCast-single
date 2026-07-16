import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ShareTokenGuard } from '../auth/guards/share-token.guard';
import { AgoraService } from '../agora/agora.service';
import { SessionService } from '../session/session.service';
import { ConfigService } from '../config/config.service';
import { KookService } from '../kook/kook.service';
import { AgoraRole } from '../agora/agora.types';

@Controller('api/share')
export class ShareController {
  constructor(
    private readonly agora: AgoraService,
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
    private readonly kookService: KookService,
  ) {}

  @Get('info')
  @UseGuards(ShareTokenGuard)
  info(@Req() req: any) {
    const info = this.sessionService.toInfo(req.session);
    return {
      ...info,
      allowedQualities: this.config.get().agora.allowedQualities,
    };
  }

  @Get('token')
  @UseGuards(ShareTokenGuard)
  token(@Req() req: any, @Query('role') role: string) {
    const r: AgoraRole = role === 'publisher' ? 'publisher' : 'subscriber';
    const uid = r === 'publisher' ? 1 : Math.floor(Math.random() * 99999) + 100;
    return this.agora.generateToken(req.session.channel, uid, r);
  }

  /** 重新发起共享：显示确认页面 */
  @Get('reshare')
  async reshare(@Query('c') channelId: string, @Res() res: any) {
    if (!channelId) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(400).send('<h2>缺少频道参数</h2>');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xgoat.Cast - 重新发起共享</title></head>' +
      '<body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;background:#0f1020;color:#fff">' +
      '<h2 style="color:#FF8C42;margin-bottom:16px">🐑 Xgoat.Cast 屏幕共享</h2>' +
      '<p style="color:#aaa;margin:16px 0 32px">确认要重新发起屏幕共享吗？</p>' +
      '<form method="POST" action="/api/share/reshare-confirm" style="display:inline-block">' +
      '<input type="hidden" name="channelId" value="' + channelId + '">' +
      '<button type="submit" style="padding:12px 32px;background:linear-gradient(135deg,#FF6B35,#FF8C42);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer">✅ 确认发起</button>' +
      '</form>' +
      '<p style="color:#666;margin-top:24px;font-size:14px">新的共享链接将推送到 KOOK 频道</p>' +
      '</body></html>',
    );
  }

  /** 确认重新发起：创建新 session 并推送共享链接卡片到频道 */
  @Post('reshare-confirm')
  async reshareConfirm(@Body('channelId') channelId: string, @Res() res: any) {
    if (!channelId) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(400).send('<h2>缺少频道参数</h2>');
      return;
    }
    const shareLink = await this.kookService.pushShareLinkCard(channelId, '重新发起');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (shareLink) {
      res.send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xgoat.Cast - 发起成功</title></head>' +
        '<body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;background:#0f1020;color:#fff">' +
        '<h2 style="color:#FF8C42">✅ 已重新发起屏幕共享</h2>' +
        '<p style="color:#aaa;margin:16px 0">新共享链接已推送到 KOOK 频道</p>' +
        '<a href="' + shareLink + '" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#FF6B35,#FF8C42);color:#fff;border-radius:12px;text-decoration:none;font-weight:600">🖥 点击开始共享</a>' +
        '</body></html>',
      );
    } else {
      res.send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Xgoat.Cast - 失败</title></head>' +
        '<body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;background:#0f1020;color:#fff">' +
        '<h2 style="color:#ef4444">❌ 重新发起失败</h2>' +
        '<p style="color:#aaa">机器人可能未连接，请稍后重试或频道发送「屏幕共享」</p>' +
        '</body></html>',
      );
    }
  }
}
