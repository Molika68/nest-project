/**
 * @file submit-answer.dto.ts
 * @description 提交回答接口的请求参数 DTO
 */

import { IsNotEmpty, IsString } from 'class-validator';

/**
 * @class SubmitAnswerDto
 * @description 提交面试回答的请求参数
 */
export class SubmitAnswerDto {
  /** 面试会话 ID */
  @IsNotEmpty()
  @IsString()
  interviewId: string;

  /** 用户的回答文本 */
  @IsNotEmpty()
  @IsString()
  answer: string;
}