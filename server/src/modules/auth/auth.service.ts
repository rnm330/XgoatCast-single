import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { ConfigService } from '../config/config.service';
import { SessionService } from '../session/session.service';
import { ShareSession } from '../session/session.types';

interface AdminTokenPayload {
  role: string;
  exp: number;
}

interface LoginAttemptRecord {
  count: number;
  lockedUntil: number; // 0 表示未锁定
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenTtlSec = 7 * 24 * 3600;

  /** 登录防暴力破解：按 IP 维度记录失败次数与锁定时间 */
  private readonly loginAttempts = new Map<string, LoginAttemptRecord>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly BASE_LOCK_SEC = 60;
  private readonly MAX_LOCK_SEC = 600;

  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
  ) {}

  generateShareToken(): string {
    return randomBytes(32).toString('hex');
  }

  verifyShareToken(token: string): ShareSession {
    const session = this.sessionService.getByToken(token);
    if (!session) {
      throw new UnauthorizedException('invalid share link');
    }
    if (session.status === 'ended') {
      throw new UnauthorizedException('share ended');
    }
    return session;
  }

  /** 查询某 IP 的登录状态：是否允许尝试、剩余次数、锁定剩余秒数 */
  getLoginState(ip: string): {
    allowed: boolean;
    retryAfterSec: number;
    remaining: number;
  } {
    const rec = this.loginAttempts.get(ip);
    const now = Date.now();
    if (rec && rec.lockedUntil && rec.lockedUntil <= now) {
      // 锁定期已过，重置计数，给用户重新尝试的机会
      rec.count = 0;
      rec.lockedUntil = 0;
    }
    if (!rec || !rec.lockedUntil) {
      return {
        allowed: true,
        retryAfterSec: 0,
        remaining: Math.max(0, this.MAX_ATTEMPTS - (rec?.count ?? 0)),
      };
    }
    return {
      allowed: false,
      retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000),
      remaining: 0,
    };
  }

  /** 记录一次登录失败，返回失败后的状态（可能触发锁定） */
  recordLoginFailure(ip: string): {
    locked: boolean;
    retryAfterSec: number;
    remaining: number;
  } {
    const now = Date.now();
    let rec = this.loginAttempts.get(ip);
    if (!rec) {
      rec = { count: 0, lockedUntil: 0 };
      this.loginAttempts.set(ip, rec);
    }
    if (rec.lockedUntil && rec.lockedUntil <= now) {
      rec.count = 0;
      rec.lockedUntil = 0;
    }
    rec.count += 1;
    if (rec.count >= this.MAX_ATTEMPTS) {
      // 锁定时长按锁定轮次递增：第 1 轮 60s，第 2 轮 120s ... 上限 600s
      const lockRound = Math.floor(rec.count / this.MAX_ATTEMPTS);
      const lockSec = Math.min(this.BASE_LOCK_SEC * lockRound, this.MAX_LOCK_SEC);
      rec.lockedUntil = now + lockSec * 1000;
      this.logger.warn(
        `admin login locked: ip=${ip}, count=${rec.count}, lockSec=${lockSec}`,
      );
      this.cleanupLoginAttempts();
      return { locked: true, retryAfterSec: lockSec, remaining: 0 };
    }
    return {
      locked: false,
      retryAfterSec: 0,
      remaining: this.MAX_ATTEMPTS - rec.count,
    };
  }

  /** 登录成功，清空该 IP 的失败记录 */
  recordLoginSuccess(ip: string): void {
    this.loginAttempts.delete(ip);
  }

  /** 清理已过期的失败记录，避免内存无限增长 */
  private cleanupLoginAttempts(): void {
    const now = Date.now();
    for (const [ip, rec] of this.loginAttempts) {
      if (rec.lockedUntil && rec.lockedUntil <= now) {
        this.loginAttempts.delete(ip);
      }
    }
  }

  signAdminToken(): string {
    const payload: AdminTokenPayload = {
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + this.tokenTtlSec,
    };
    return this.encode(payload);
  }

  verifyAdminToken(token: string): boolean {
    const payload = this.decode(token);
    if (!payload || payload.role !== 'admin') return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  }

  verifyPassword(plain: string): boolean {
    return this.config.verifyAdminPassword(plain);
  }

  private get secret(): string {
    return this.config.get().admin.passwordHash || 'xgoatcast-fallback-secret';
  }

  private encode(payload: AdminTokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret)
      .update(body)
      .digest('base64url');
    return body + '.' + sig;
  }

  private decode(token: string): AdminTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const body = parts[0];
    const sig = parts[1];
    const expected = createHmac('sha256', this.secret)
      .update(body)
      .digest('base64url');
    if (sig !== expected) return null;
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    } catch {
      return null;
    }
  }
}
