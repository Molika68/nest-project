/**
 * @file interview.service.ts
 * @description 面试核心服务，负责面试流程管理、问题生成和结果计算
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AiService } from '../ai/ai.service';
import { ResumeService } from '../resume/resume.service';

/**
 * @interface StartInterviewResponse
 * @description 开始面试接口的响应结构
 */
export interface StartInterviewResponse {
  /** 面试会话 ID */
  interviewId: string;
  /** 第一道面试题 */
  question: {
    id: string;
    questionText: string;
  };
}

/**
 * @interface SubmitAnswerResponse
 * @description 提交回答接口的响应结构
 */
export interface SubmitAnswerResponse {
  /** 响应类型：followup(追问)、next(下一题)、finished(面试结束) */
  type: 'followup' | 'next' | 'finished';
  /** 下一道问题（追问或新题） */
  question?: {
    id: string;
    questionText: string;
  };
  /** 当前回答的评分结果 */
  evaluation?: {
    technicalScore: number;
    communicationScore: number;
    experienceScore: number;
    feedback: string;
  };
}

/**
 * @interface InterviewResult
 * @description 面试结果数据结构
 */
export interface InterviewResult {
  /** 技术深度平均分 */
  technicalScore: number;
  /** 表达能力平均分 */
  communicationScore: number;
  /** 项目经验平均分 */
  experienceScore: number;
  /** AI 生成的综合评价 */
  summary: string;
  /** 所有面试问题和回答记录 */
  questions: Array<{
    id: string;
    questionText: string;
    answerText?: string | null;
    technicalScore?: number | null;
    communicationScore?: number | null;
    experienceScore?: number | null;
    feedback?: string | null;
    createdAt: Date;
  }>;
}

/**
 * @class InterviewService
 * @description 面试服务类，封装面试流程核心逻辑
 */
@Injectable()
export class InterviewService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private resumeService: ResumeService,
  ) {}

  /**
   * @description 开始新的面试会话
   * @param fileBuffer - 简历 PDF 文件的 Buffer 数据
   * @returns Promise<StartInterviewResponse> - 面试 ID 和第一道题目
   */
  async startInterview(fileBuffer: Buffer): Promise<StartInterviewResponse> {
    // 1. 解析简历 PDF
    const resumeText = await this.resumeService.parsePdf(fileBuffer);

    // 2. 创建面试记录
    const interview = await this.prisma.interview.create({
      data: { resumeText, status: 'active' },
    });

    // 3. 调用 AI 生成第一道面试题
    const questionText = await this.aiService.generateQuestion(resumeText, 1);

    // 4. 创建问题记录
    const question = await this.prisma.question.create({
      data: { interviewId: interview.id, questionText },
    });

    return {
      interviewId: interview.id,
      question: {
        id: question.id,
        questionText: question.questionText,
      },
    };
  }

  /**
   * @description 提交面试回答，返回追问或下一题
   * @param interviewId - 面试会话 ID
   * @param answer - 用户的回答文本
   * @returns Promise<SubmitAnswerResponse> - 追问/下一题/结束标识
   */
  async submitAnswer(
    interviewId: string,
    answer: string,
  ): Promise<SubmitAnswerResponse> {
    // 1. 获取当前未完成的问题
    const currentQuestion = await this.prisma.question.findFirst({
      where: { interviewId, isCompleted: false },
    });

    if (!currentQuestion) {
      return { type: 'finished' };
    }

    // 2. 调用 AI 评估回答
    const evaluation = await this.aiService.evaluateAnswer(
      currentQuestion.questionText,
      answer,
    );

    // 3. 更新问题记录（保存回答和评分）
    await this.prisma.question.update({
      where: { id: currentQuestion.id },
      data: {
        answerText: answer,
        technicalScore: evaluation.technicalScore,
        communicationScore: evaluation.communicationScore,
        experienceScore: evaluation.experienceScore,
        feedback: evaluation.feedback,
        followUpCount: currentQuestion.followUpCount + 1,
      },
    });

    // 4. 判断是否需要追问（得分低于 60 且追问次数少于 2 次）
    if (evaluation.averageScore < 60 && currentQuestion.followUpCount < 2) {
      const followUpQuestionText = await this.aiService.generateFollowUp(
        currentQuestion.questionText,
        answer,
      );

      const followUpQuestion = await this.prisma.question.create({
        data: {
          interviewId,
          questionText: followUpQuestionText,
        },
      });

      return {
        type: 'followup',
        question: {
          id: followUpQuestion.id,
          questionText: followUpQuestion.questionText,
        },
        evaluation,
      };
    }

    // 5. 检查是否已完成 5 道题
    const questionCount = await this.prisma.question.count({ where: { interviewId } });

    if (questionCount >= 5) {
      // 更新面试状态为已完成
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { status: 'completed' },
      });

      return {
        type: 'finished',
        evaluation,
      };
    }

    // 6. 生成下一道面试题
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      return { type: 'finished', evaluation };
    }

    const nextQuestionText = await this.aiService.generateQuestion(
      interview.resumeText,
      questionCount + 1,
    );

    const nextQuestion = await this.prisma.question.create({
      data: { interviewId, questionText: nextQuestionText },
    });

    return {
      type: 'next',
      question: {
        id: nextQuestion.id,
        questionText: nextQuestion.questionText,
      },
      evaluation,
    };
  }

  /**
   * @description 获取面试结果（评分和评价）
   * @param interviewId - 面试会话 ID
   * @returns Promise<InterviewResult> - 面试结果数据
   */
  async getResult(interviewId: string): Promise<InterviewResult> {
    // 1. 获取所有面试问题
    const questions = await this.prisma.question.findMany({
      where: { interviewId },
      orderBy: { createdAt: 'asc' },
    });

    // 2. 计算各维度平均分
    const avgTechnical = this.calculateAverage(
      questions.map((q) => q.technicalScore || 0)
    );
    const avgCommunication = this.calculateAverage(
      questions.map((q) => q.communicationScore || 0)
    );
    const avgExperience = this.calculateAverage(
      questions.map((q) => q.experienceScore || 0)
    );

    // 3. 调用 AI 生成综合评价
    const summary = await this.aiService.generateSummary(questions);

    return {
      technicalScore: avgTechnical,
      communicationScore: avgCommunication,
      experienceScore: avgExperience,
      summary,
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        answerText: q.answerText,
        technicalScore: q.technicalScore,
        communicationScore: q.communicationScore,
        experienceScore: q.experienceScore,
        feedback: q.feedback,
        createdAt: q.createdAt,
      })),
    };
  }

  /**
   * @description 计算数组的平均值
   * @param scores - 分数数组
   * @returns number - 平均分（四舍五入）
   */
  private calculateAverage(scores: number[]): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round(sum / scores.length);
  }
}