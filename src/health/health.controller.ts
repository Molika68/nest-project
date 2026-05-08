import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import { CreateHealthDto } from './dto/create-health.dto';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return `{ status: 'ok' }`;
  }

  @Post()
  @HttpCode(200)
  postHealth(@Body() CreateHealthDto: CreateHealthDto) {
    // return `{ name: "123", age: 18, gender: "male"}`;
    console.log(CreateHealthDto);
    return CreateHealthDto;
  }

  @Put()
  putHealth() {}

  @Delete()
  deleteHealth() {}
}
