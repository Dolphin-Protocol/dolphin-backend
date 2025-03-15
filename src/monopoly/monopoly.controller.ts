import { Controller, Get } from '@nestjs/common';

@Controller()
export class MonopolyController {
  constructor() {}

  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}
