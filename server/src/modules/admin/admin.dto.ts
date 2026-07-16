import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';

export class LoginDto {
  @IsString()
  password!: string;
}

export class UpdatePasswordDto {
  @IsString()
  oldPassword!: string;
  @IsString()
  newPassword!: string;
}

class AgoraConfigDto {
  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  appCertificate?: string;

  @IsOptional()
  @IsNumber()
  @Min(60)
  tokenExpireSec?: number;

  @IsOptional()
  @IsArray()
  allowedQualities?: string[];
}

class KookConfigDto {
  @IsOptional()
  @IsString()
  botToken?: string;

  @IsOptional()
  @IsString()
  triggerWords?: string;
}

class SessionConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(5)
  gracePeriodSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  noPublisherTimeoutSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  heartbeatIntervalSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  shareStopGraceSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  noViewerTimeoutSec?: number;
}

class ServerConfigDto {
  @IsOptional()
  @IsString()
  publicDomain?: string;
}

export class UpdateConfigDto {
  @IsOptional()
  agora?: AgoraConfigDto;

  @IsOptional()
  kook?: KookConfigDto;

  @IsOptional()
  session?: SessionConfigDto;

  @IsOptional()
  server?: ServerConfigDto;
}

export class ManualShareDto {
  @IsString()
  sharerUserId!: string;

  @IsString()
  sharerUsername!: string;

  @IsOptional()
  @IsString()
  guildId?: string;

  @IsOptional()
  @IsString()
  targetChannelId?: string;
}
