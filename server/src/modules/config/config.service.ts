import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../storage/storage.service';
import { AppConfig, CONFIG_FILE, DEFAULT_CONFIG } from './config.types';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private config: AppConfig = { ...DEFAULT_CONFIG };
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor(private readonly storage: StorageService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = this.loadConfig();
    await this.loading;
  }

  private async loadConfig(): Promise<void> {
    await this.storage.ensureDir();
    const loaded = await this.storage.readJson<AppConfig>(CONFIG_FILE, null);

    if (loaded) {
      this.config = { ...DEFAULT_CONFIG, ...loaded };
      this.config.agora = { ...DEFAULT_CONFIG.agora, ...loaded.agora };
      this.config.kook = { ...DEFAULT_CONFIG.kook, ...loaded.kook };
      this.config.session = { ...DEFAULT_CONFIG.session, ...loaded.session };
      this.config.admin = { ...DEFAULT_CONFIG.admin, ...loaded.admin };
      this.config.server = { ...DEFAULT_CONFIG.server, ...loaded.server };
    } else {
      this.config = this.buildFromEnv();
      await this.persist();
      this.logger.log('首次启动，已从环境变量生成 config.json');
    }

    this.loaded = true;
  }

  private buildFromEnv(): AppConfig {
    return {
      agora: {
        appId: process.env.AGORA_APP_ID || '',
        appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
        tokenExpireSec: 3600,
        allowedQualities: (process.env.AGORA_ALLOWED_QUALITIES || '540p30,720p30,1080p30,1080p60,1440p30,1440p60,4k30')
          .split(',')
          .map((q) => q.trim())
          .filter(Boolean),
      },
      kook: {
        botToken: process.env.KOOK_BOT_TOKEN || '',
        triggerWords: process.env.KOOK_TRIGGER_WORDS || '屏幕共享,共享屏幕',
      },
      session: {
        idleTimeoutSec: 60,
        heartbeatIntervalSec: 5,
        noViewerTimeoutSec: 180,
      },
      admin: {
        passwordHash: bcrypt.hashSync(
          process.env.ADMIN_PASSWORD || 'xgoatcast-admin',
          10,
        ),
      },
      server: {
        publicDomain: process.env.PUBLIC_DOMAIN || 'http://localhost:3520',
      },
    };
  }

  get(): AppConfig {
    return this.config;
  }

  async update(partial: Partial<AppConfig>): Promise<AppConfig> {
    this.config = {
      ...this.config,
      ...partial,
      agora: { ...this.config.agora, ...(partial.agora || {}) },
      kook: { ...this.config.kook, ...(partial.kook || {}) },
      session: { ...this.config.session, ...(partial.session || {}) },
      admin: { ...this.config.admin, ...(partial.admin || {}) },
      server: { ...this.config.server, ...(partial.server || {}) },
    };
    await this.persist();
    return this.config;
  }

  async setAdminPassword(plain: string): Promise<void> {
    this.config.admin.passwordHash = bcrypt.hashSync(plain, 10);
    await this.persist();
  }

  verifyAdminPassword(plain: string): boolean {
    if (!this.config.admin.passwordHash) return false;
    return bcrypt.compareSync(plain, this.config.admin.passwordHash);
  }

  buildShareLink(token: string): string {
    return `${this.config.server.publicDomain}/share?t=${token}`;
  }

  buildViewLink(token: string): string {
    return `${this.config.server.publicDomain}/view?t=${token}`;
  }

  private async persist(): Promise<void> {
    await this.storage.writeJson(CONFIG_FILE, this.config);
  }
}
