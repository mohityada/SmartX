import { IsDateString } from 'class-validator';

export class ScheduleTweetDto {
  @IsDateString()
  scheduledFor: string;
}
