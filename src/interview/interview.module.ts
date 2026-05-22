/**
 * @file interview.module.ts
 * @description 面试模块定义，整合面试相关的控制器、服务和依赖
 */

import { Module } from '@nestjs/common';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { PrismaService } from './prisma.service';
import { AiModule } from '../ai/ai.module';
import { ResumeModule } from '../resume/resume.module';

@Module({
  imports: [AiModule, ResumeModule],
  controllers: [InterviewController],
  providers: [InterviewService, PrismaService],
})
export class InterviewModule {}