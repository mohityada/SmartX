import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as express from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { XOAuthService } from './x-oauth.service';
import { JwtAuthGuard, CurrentUser } from '../common';

@ApiTags('X OAuth')
@Controller('auth/x')
export class XOAuthController {
  private readonly logger = new Logger(XOAuthController.name);

  constructor(private readonly xOAuthService: XOAuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('authorize')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate X OAuth2 authorization flow',
    description:
      'Redirects the user to X authorization screen. Requires JWT token.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to X OAuth screen' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  authorize(
    @CurrentUser('id') userId: string,
    @Res() res: express.Response,
  ): void {
    const authUrl = this.xOAuthService.getAuthorizationUrl(userId);
    this.logger.log(`Redirecting user ${userId} to X OAuth`);
    res.redirect(authUrl);
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Handle X OAuth2 callback',
    description:
      'Exchanges the authorization code for tokens and links the X account. Redirects to frontend.',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  @ApiResponse({ status: 302, description: 'Redirect to frontend on success or error' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: express.Response,
  ): Promise<void> {
    const frontendBaseUrl =
      process.env.FRONTEND_URL ?? 'http://localhost:3001';

    // Handle user denial or error from X
    if (error) {
      this.logger.warn(`X OAuth error: ${error}`);
      res.redirect(
        `${frontendBaseUrl}/dashboard/settings?x_auth=error&reason=${encodeURIComponent(error)}`,
      );
      return;
    }

    if (!code || !state) {
      res.redirect(
        `${frontendBaseUrl}/dashboard/settings?x_auth=error&reason=missing_params`,
      );
      return;
    }

    try {
      const result = await this.xOAuthService.handleCallback(code, state);
      res.redirect(
        `${frontendBaseUrl}/dashboard/settings?x_auth=success&username=${encodeURIComponent(result.xUsername)}`,
      );
    } catch (err) {
      this.logger.error(
        `X OAuth callback failed: ${err instanceof Error ? err.message : err}`,
      );
      res.redirect(
        `${frontendBaseUrl}/dashboard/settings?x_auth=error&reason=callback_failed`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected X accounts for current user' })
  @ApiResponse({ status: 200, description: 'List of X accounts' })
  listAccounts(@CurrentUser('id') userId: string) {
    return this.xOAuthService.listXAccounts(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('accounts/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect an X account' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Account disconnected' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async disconnectAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.xOAuthService.disconnectXAccount(id, userId);
  }
}
