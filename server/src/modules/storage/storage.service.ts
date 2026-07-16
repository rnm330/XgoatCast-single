import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly dataDir: string;
  private cache = new Map<string, unknown>();

  constructor() {
    this.dataDir = join(process.cwd(), 'data');
  }

  private filePath(filename: string): string {
    return join(this.dataDir, filename);
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async readJson<T>(filename: string, fallback: T): Promise<T> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename) as T;
    }
    try {
      const raw = await fs.readFile(this.filePath(filename), 'utf-8');
      const data = JSON.parse(raw) as T;
      this.cache.set(filename, data);
      return data;
    } catch {
      return fallback;
    }
  }

  async writeJson<T>(filename: string, data: T): Promise<void> {
    this.cache.set(filename, data);
    await this.ensureDir();
    // 原子写入：先写临时文件再 rename，防止崩溃损坏
    const target = this.filePath(filename);
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, target);
  }

  getCached<T>(filename: string): T | undefined {
    return this.cache.get(filename) as T | undefined;
  }
}
