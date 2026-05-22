/**
 * @file ai.module.ts
 * @description AI 模块定义，提供 AI 服务依赖注入
 */

import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}