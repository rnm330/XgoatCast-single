import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ShareTokenGuard } from './guards/share-token.guard';
import { AdminGuard } from './guards/admin.guard';

@Global()
@Module({
  providers: [AuthService, ShareTokenGuard, AdminGuard],
  exports: [AuthService, ShareTokenGuard, AdminGuard],
})
export class AuthModule {}
