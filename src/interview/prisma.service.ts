/**
 * @file prisma.service.ts
 * @description Prisma 数据库服务，封装数据库连接和操作
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

/**
 * @class PrismaService
 * @description Prisma 服务类，继承 PrismaClient 并实现模块初始化钩子
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const url =
      process.env.TURSO_DATABASE_URL ?? 'file:./prisma/dev.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;

    const adapter = new PrismaLibSql(
      authToken ? { url, authToken } : { url },
    );

    super({ adapter });
  }

  /**
   * @description 模块初始化时自动连接数据库
   */
  async onModuleInit() {
    await this.$connect();
  }
}
