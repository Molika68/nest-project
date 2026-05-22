/**
 * @file prisma.service.ts
 * @description Prisma 数据库服务，封装数据库连接和操作
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * @class PrismaService
 * @description Prisma 服务类，继承 PrismaClient 并实现模块初始化钩子
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /**
   * @description 模块初始化时自动连接数据库
   */
  async onModuleInit() {
    await this.$connect();
  }
}