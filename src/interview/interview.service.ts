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
  /** 从简历中提取的技术栈列表 */
  extractedTechSkills: string[];
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
    /** 技术栈评分（如 {"React": 85, "Vue": 78}） */
    techSkillScores?: Record<string, number>;
  };
}

/**
 * @interface SkillItem
 * @description 技能指标项（用于雷达图）
 */
export interface SkillItem {
  /** 技能名称 */
  name: string;
  /** 技能得分 */
  score: number;
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
  /** 动态技能评分维度（用于雷达图） */
  skills: SkillItem[];
  /** 所有面试问题和回答记录 */
  questions: Array<{
    id: string;
    questionText: string;
    answerText?: string | null;
    technicalScore?: number | null;
    communicationScore?: number | null;
    experienceScore?: number | null;
    feedback?: string | null;
    /** 该问题涉及的技术栈 */
    techSkills?: string[];
    /** 技术栈评分 */
    techSkillScores?: Record<string, number>;
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

    // 2. 提取简历中的技术栈关键词
    const extractedTechSkills = this.resumeService.extractSkills(resumeText);

    // 3. 创建面试记录（包含提取的技术栈）
    const interview = await this.prisma.interview.create({
      data: {
        resumeText,
        status: 'active',
        extractedTechSkills: JSON.stringify(extractedTechSkills),
      },
    });

    // 4. 调用 AI 生成第一道面试题
    const questionResult = await this.aiService.generateQuestion(resumeText, 1);

    // 5. 创建问题记录（记录涉及的技术栈）
    const question = await this.prisma.question.create({
      data: {
        interviewId: interview.id,
        questionText: questionResult.questionText,
        techSkills: JSON.stringify(questionResult.techSkills),
      },
    });

    return {
      interviewId: interview.id,
      question: {
        id: question.id,
        questionText: question.questionText,
      },
      extractedTechSkills,
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

    // 2. 获取该问题涉及的技术栈
    let techSkills: string[] = [];
    if (currentQuestion.techSkills) {
      try {
        techSkills = JSON.parse(currentQuestion.techSkills);
      } catch {
        techSkills = [];
      }
    }

    // 3. 调用 AI 评估回答（传入技术栈用于专项评分）
    const evaluation = await this.aiService.evaluateAnswer(
      currentQuestion.questionText,
      answer,
      techSkills,
    );

    // 4. 更新问题记录（保存回答、评分和技术栈评分，并标记为已完成）
    await this.prisma.question.update({
      where: { id: currentQuestion.id },
      data: {
        answerText: answer,
        technicalScore: evaluation.technicalScore,
        communicationScore: evaluation.communicationScore,
        experienceScore: evaluation.experienceScore,
        feedback: evaluation.feedback,
        techSkillScores: JSON.stringify(evaluation.techSkillScores || {}),
        followUpCount: currentQuestion.followUpCount + 1,
        isCompleted: true, // 标记问题已完成
      },
    });

    // 4. 判断是否需要追问（得分低于 60 且追问次数少于 2 次）
    if (evaluation.averageScore < 60 && currentQuestion.followUpCount < 2) {
      const followUpQuestionText = await this.aiService.generateFollowUp(
        currentQuestion.questionText,
        answer,
      );

      // 将原问题标记为已完成
      await this.prisma.question.update({
        where: { id: currentQuestion.id },
        data: { isCompleted: true },
      });

      // 追问不生成新技术栈，使用原问题的技术栈
      const followUpQuestion = await this.prisma.question.create({
        data: {
          interviewId,
          questionText: followUpQuestionText,
          techSkills: currentQuestion.techSkills || '[]',
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
    const questionCount = await this.prisma.question.count({
      where: { interviewId },
    });

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

    // 6. 生成下一道面试题（传入历史记录避免重复）
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      return { type: 'finished', evaluation };
    }

    // 获取之前的问答历史
    const historyQuestions = await this.prisma.question.findMany({
      where: { interviewId },
      orderBy: { createdAt: 'asc' },
    });

    const nextQuestionResult = await this.aiService.generateQuestion(
      interview.resumeText,
      questionCount + 1,
      historyQuestions,
    );

    const nextQuestion = await this.prisma.question.create({
      data: {
        interviewId,
        questionText: nextQuestionResult.questionText,
        techSkills: JSON.stringify(nextQuestionResult.techSkills),
      },
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
      questions.map((q) => q.technicalScore || 0),
    );
    const avgCommunication = this.calculateAverage(
      questions.map((q) => q.communicationScore || 0),
    );
    const avgExperience = this.calculateAverage(
      questions.map((q) => q.experienceScore || 0),
    );

    // 3. 收集动态技能评分（仅包含被问到且有评分的技术栈）
    const techSkillMap = new Map<string, number[]>();

    for (const q of questions) {
      if (q.techSkillScores) {
        try {
          const scores = JSON.parse(q.techSkillScores) as Record<
            string,
            number
          >;
          Object.entries(scores).forEach(([skill, score]) => {
            if (!techSkillMap.has(skill)) {
              techSkillMap.set(skill, []);
            }
            techSkillMap.get(skill)!.push(score);
          });
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 计算每个技术栈的平均分
    const dynamicSkills: SkillItem[] = [];
    techSkillMap.forEach((scores, skill) => {
      if (scores.length > 0) {
        dynamicSkills.push({
          name: skill,
          score: this.calculateAverage(scores),
        });
      }
    });

    // 4. 调用 AI 生成综合评价
    const summary = await this.aiService.generateSummary(questions);

    return {
      technicalScore: avgTechnical,
      communicationScore: avgCommunication,
      experienceScore: avgExperience,
      summary,
      skills: dynamicSkills,
      questions: questions.map((q) => {
        let techSkills: string[] = [];
        let techSkillScores: Record<string, number> = {};

        if (q.techSkills) {
          try {
            techSkills = JSON.parse(q.techSkills);
          } catch {
            techSkills = [];
          }
        }

        if (q.techSkillScores) {
          try {
            techSkillScores = JSON.parse(q.techSkillScores);
          } catch {
            techSkillScores = {};
          }
        }

        return {
          id: q.id,
          questionText: q.questionText,
          answerText: q.answerText,
          technicalScore: q.technicalScore,
          communicationScore: q.communicationScore,
          experienceScore: q.experienceScore,
          feedback: q.feedback,
          techSkills,
          techSkillScores,
          createdAt: q.createdAt,
        };
      }),
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
