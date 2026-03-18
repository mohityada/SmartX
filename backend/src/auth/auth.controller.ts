import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthTokensDto } from './dto';
import { JwtAuthGuard, CurrentUser } from '../common';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered',
    type: AuthTokensDto,
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.authService.register(dto);
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthTokensDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(
    @Request() req: { user: { id: string; email: string } },
    @Body() _dto: LoginDto,
  ): AuthTokensDto {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed',
    type: AuthTokensDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  refresh(@CurrentUser('id') userId: string): Promise<AuthTokensDto> {
    return this.authService.refreshToken(userId);
  }
}
