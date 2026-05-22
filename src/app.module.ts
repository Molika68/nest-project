/**
 * @file app.module.ts
 * @description 应用根模块，整合所有功能模块
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MaterialsModule } from './materials/materials.module';
import { PetModule } from './pet/pet.module';
import { InterviewModule } from './interview/interview.module';
import { AiModule } from './ai/ai.module';
import { ResumeModule } from './resume/resume.module';

@Module({
  imports: [
    // 配置模块，全局加载环境变量
    ConfigModule.forRoot({ isGlobal: true }),
    // 健康检查模块
    HealthModule,
    // 素材模块
    MaterialsModule,
    // 宠物模块
    PetModule,
    // 面试核心模块
    InterviewModule,
    // AI 服务模块
    AiModule,
    // 简历处理模块
    ResumeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}