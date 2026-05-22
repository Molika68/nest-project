/**
 * @file interview.controller.ts
 * @description 面试 API 控制器，提供面试相关的 REST 接口
 */

import { Controller, Post, Get, Param, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InterviewService } from './interview.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

/**
 * @class InterviewController
 * @description 面试控制器，处理面试相关的 HTTP 请求
 */
@Controller('api/interview')
export class InterviewController {
  constructor(private interviewService: InterviewService) {}

  /**
   * @description 开始面试接口，上传简历并生成第一道题
   * @param file - 上传的简历 PDF 文件
   * @returns Promise - 面试 ID 和第一道题目
   */
  @Post('start')
  @UseInterceptors(FileInterceptor('resume'))
  async startInterview(@UploadedFile() file: Express.Multer.File) {
    return this.interviewService.startInterview(file.buffer);
  }

  /**
   * @description 提交回答接口，返回追问或下一题
   * @param dto - 提交回答的请求参数
   * @returns Promise - 追问/下一题/结束标识
   */
  @Post('answer')
  async submitAnswer(@Body() dto: SubmitAnswerDto) {
    return this.interviewService.submitAnswer(dto.interviewId, dto.answer);
  }

  /**
   * @description 获取面试结果接口
   * @param id - 面试会话 ID
   * @returns Promise - 面试结果（评分和评价）
   */
  @Get('result/:id')
  async getResult(@Param('id') id: string) {
    return this.interviewService.getResult(id);
  }
}