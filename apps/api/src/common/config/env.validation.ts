import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  DATABASE_URL: string;

  @IsInt()
  @Min(3000)
  @Max(65535)
  PORT: number = 4000;

  @IsInt()
  @Min(1)
  @Max(65535)
  WEB_PORT: number = 3000;

  @IsOptional()
  @IsString()
  WEB_ORIGINS?: string;

  @IsString()
  UPLOAD_DIR: string = 'uploads';

  @IsInt()
  @Min(1)
  @Max(200)
  MAX_UPLOAD_MB: number = 25;

  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  ACCESS_TOKEN_TTL: string = '15m';

  @IsInt()
  @Min(1)
  @Max(30)
  REFRESH_TOKEN_DAYS: number = 30;

  @IsString()
  COOKIE_NAME_REFRESH: string = 'madc_rt';

  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_ROUNDS: number = 10;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
