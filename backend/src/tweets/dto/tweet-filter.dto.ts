import { IsOptional, IsString, IsIn } from 'class-validator';

export class TweetFilterDto {
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'approved', 'scheduled', 'posted', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  botId?: string;
}
