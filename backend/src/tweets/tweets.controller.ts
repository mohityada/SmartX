import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { TweetsService } from './tweets.service';
import { TweetFilterDto } from './dto/tweet-filter.dto';
import { EditTweetDto } from './dto/edit-tweet.dto';
import { ScheduleTweetDto } from './dto/schedule-tweet.dto';
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

  @Patch(':id')
  editTweet(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EditTweetDto,
  ) {
    return this.tweetsService.editTweet(id, userId, dto);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tweetsService.approve(id, userId);
  }

  @Post(':id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ScheduleTweetDto,
  ) {
    return this.tweetsService.scheduleAt(id, userId, dto);
  }

  @Post(':id/post-now')
  postNow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tweetsService.postNow(id, userId);
  }
}
