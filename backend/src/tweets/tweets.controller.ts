import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetFilterDto } from './dto/tweet-filter.dto';
import { JwtAuthGuard, CurrentUser } from '../common';

@UseGuards(JwtAuthGuard)
@Controller('tweets')
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() filters: TweetFilterDto) {
    return this.tweetsService.findAllByUser(userId, filters);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tweetsService.findOne(id, userId);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tweetsService.approve(id, userId);
  }

  @Post(':id/post-now')
  postNow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tweetsService.postNow(id, userId);
  }
}
