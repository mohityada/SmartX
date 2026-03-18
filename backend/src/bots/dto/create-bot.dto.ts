import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsArray,
  IsUUID,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventSubscriptionDto {

  @ApiProperty({ example: 'crypto', description: 'Event source (e.g. crypto, news)' })
  @IsString()
  @MaxLength(50)
  source: string;

  @ApiProperty({ example: 'price_alert', description: 'Event category within the source' })
  @IsString()
  @MaxLength(50)
  category: string;
}

export class CreateBotDto {
  @ApiProperty({ example: 'CryptoBot', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'A witty crypto analyst who drops alpha in plain English',
    description: 'Bot personality / system prompt persona',
  })
  @IsOptional()
  @IsString()
  persona?: string;

  @ApiPropertyOptional({ example: 'witty', default: 'neutral' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    description: 'UUID of the linked X account',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  xAccountId?: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Number of tweets per day',
    minimum: 1,
    maximum: 100,
    default: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  postingFrequency?: number;

  @ApiPropertyOptional({
    example: ['bitcoin', 'ethereum', 'defi'],
    description: 'Content topics the bot should tweet about',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @ArrayMaxSize(20)
  topics?: string[];

  @ApiPropertyOptional({
    description: 'Event sources the bot subscribes to (data sources)',
    type: [EventSubscriptionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventSubscriptionDto)
  @ArrayMaxSize(20)
  eventSubscriptions?: EventSubscriptionDto[];
}
