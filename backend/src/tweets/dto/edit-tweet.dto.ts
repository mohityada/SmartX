import { IsString, MaxLength, MinLength } from 'class-validator';

export class EditTweetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content: string;
}
