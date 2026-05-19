import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import type { JwtPayload } from './jwt-payload.interface';
import { UserRole } from '../user-role.enum';
import { AuthService } from './auth.service';
import { ApprovePasswordResetDto } from './dto/approve-password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login (JWT)' })
  @ApiOkResponse({ description: 'access_token + user' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Current user + permissions' })
  @ApiOkResponse()
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  @Patch('change-password')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Foydalanuvchi o\'z parolini o\'zgartiradi (eski parol talab qilinadi)' })
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtPayload) {
    return this.auth.changePassword(user.sub, dto);
  }

  @Post('request-password-reset')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Parolni tiklash so\'rovini superadminga yuborish (eski parol talab qilinmaydi)' })
  requestPasswordReset(@CurrentUser() user: JwtPayload) {
    return this.auth.requestPasswordReset(user.sub);
  }

  @Post('approve-password-reset/:notificationId')
  @ApiBearerAuth('jwt')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Superadmin parol tiklash so\'rovini tasdiqlaydi va yangi parol o\'rnatadi' })
  approvePasswordReset(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Body() dto: ApprovePasswordResetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auth.approvePasswordReset(notificationId, dto, user);
  }
}
