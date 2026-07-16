import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { SessionGateway } from './session.gateway';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SessionService, SessionGateway],
  exports: [SessionService],
})
export class SessionModule {}
