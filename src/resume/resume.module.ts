/**
 * @file resume.module.ts
 * @description 简历处理模块定义，提供简历解析服务依赖注入
 */

import { Module } from '@nestjs/common';
import { ResumeService } from './resume.service';

@Module({
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}