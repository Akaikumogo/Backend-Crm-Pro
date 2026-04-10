import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@ApiExcludeController()
@Public()
@Controller()
export class AppController {
  @Get()
  root() {
    return { ok: true, docs: '/api' };
  }
}
