import { Module } from '@nestjs/common';
import { EventsModule } from './modules/events/events.module';
import { ConfigModule } from './modules/config/config.module';
import { StorageModule } from './modules/storage/storage.module';
import { AgoraModule } from './modules/agora/agora.module';
import { SessionModule } from './modules/session/session.module';
import { AuthModule } from './modules/auth/auth.module';
import { KookModule } from './modules/kook/kook.module';
import { AdminModule } from './modules/admin/admin.module';
import { ShareModule } from './modules/share/share.module';

@Module({
  imports: [
    EventsModule,
    ConfigModule,
    StorageModule,
    AgoraModule,
    SessionModule,
    AuthModule,
    KookModule,
    AdminModule,
    ShareModule,
  ],
})
export class AppModule {}
