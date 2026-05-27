/**
 * @file ai.service.ts
 * @description AI 服务核心模块，负责面试题生成、回答评分和综合评价生成
 * 支持 Ollama（本地开发）和 DeepSeek（上线）两种 AI 提供商
 */

import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * @interface EvaluationResult
 * @description 面试回答评分结果
 */
export interface EvaluationResult {
  /** 技术深度得分 (0-100) */
  technicalScore: number;
  /** 表达能力得分 (0-100) */
  communicationScore: number;
  /** 项目经验得分 (0-100) */
  experienceScore: number;
  /** AI 生成的评价反馈 */
  feedback: string;
  /** 三项得分的平均值 */
  averageScore: number;
  /** 该问题涉及的技术栈评分（动态维度，如 {"React": 85, "Vue": 78}） */
  techSkillScores?: Record<string, number>;
}

/**
 * @interface QuestionResult
 * @description 生成的面试题结果
 */
export interface QuestionResult {
  /** 面试题文本 */
  questionText: string;
  /** 该问题涉及的技术栈列表 */
  techSkills: string[];
}

/**
 * @class AiService
 * @description AI 服务类，封装 LangChain 调用逻辑
 */
@Injectable()
export class AiService {
  /** LLM 实例 */
  private llm: BaseChatModel;

  constructor() {
    this.llm = this.createLlm();
  }

  /**
   * @description 根据环境变量创建对应的 LLM 实例
   * @returns BaseChatModel - LLM 实例
   */
  private createLlm(): BaseChatModel {
    const provider = process.env.AI_PROVIDER || 'ollama';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5-64k';
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // 如果配置了 DeepSeek，优先使用
    if (provider === 'deepseek' && apiKey) {
      return new ChatDeepSeek({
        apiKey,
        model: 'deepseek-chat',
      }) as unknown as BaseChatModel;
    }

    // 默认使用 Ollama 本地模型
    return new ChatOllama({
      baseUrl: 'http://localhost:11434',
      model,
    }) as unknown as BaseChatModel;
  }

  /**
   * @description 调用 LLM 并获取响应内容
   * @param prompt - 提示词
   * @returns Promise<string> - AI 响应文本
   */
  private async getResponseContent(prompt: string): Promise<string> {
    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content;
      if (typeof content === 'string') {
        return content.trim();
      }
      return '请介绍一下你最擅长的技术栈？';
    } catch (error) {
      console.error('LLM 调用失败:', error);
      return '';
    }
  }

  /**
   * @description 根据简历内容生成面试题
   * @param resumeText - 简历文本内容
   * @param questionCount - 当前题目序号（第几题）
   * @returns Promise<QuestionResult> - 生成的面试题及涉及的技术栈
   */
  async generateQuestion(
    resumeText: string,
    questionCount: number,
  ): Promise<QuestionResult> {
    // 提取简历中的技能关键词
    const skills = this.extractSkillsFromResume(resumeText);
    const skillStr =
      skills.length > 0 ? `（相关技能：${skills.join('、')}）` : '';

    const prompt = `
请根据以下简历内容生成第 ${questionCount} 道面试题${skillStr}：

简历内容：
${resumeText.slice(0, 1000)}

要求：
1. 问题要与简历中提到的技术栈或项目经验相关
2. 难度适中，能考察实际工作能力
3. 问题要具体，避免过于宽泛
4. 语言简洁清晰，使用中文提问
5. 如果问题涉及特定技术栈，请在回答最后用 【技术栈：xxx】 格式标注

请按以下 JSON 格式输出：
{
  "question": "面试题内容",
  "techSkills": ["React", "Vue"] // 该问题涉及的技术栈，没有则为空数组
}
    `.trim();

    const result = await this.getResponseContent(prompt);
    if (!result) {
      return {
        questionText: this.generateFallbackQuestion(questionCount),
        techSkills: [],
      };
    }

    return this.parseQuestionResult(result, skills);
  }

  /**
   * @description 解析 AI 返回的题目 JSON
   * @param content - AI 响应内容
   * @param resumeSkills - 简历中的技术栈（用于兜底）
   * @returns QuestionResult - 解析后的题目结果
   */
  private parseQuestionResult(
    content: string,
    resumeSkills: string[],
  ): QuestionResult {
    try {
      // 提取 JSON 部分
      const jsonStr = content.match(/\{[\s\S]*\}/);
      if (jsonStr) {
        const result = JSON.parse(jsonStr[0]);
        return {
          questionText: result.question || content,
          techSkills: Array.isArray(result.techSkills)
            ? result.techSkills.filter((s: string) =>
                resumeSkills.some((rs) => rs.toLowerCase() === s.toLowerCase()),
              )
            : [],
        };
      }
    } catch (error) {
      console.error('解析题目结果失败:', error);
    }

    // 解析失败时尝试从内容中提取技术栈
    const foundSkills = resumeSkills.filter((skill) =>
      content.toLowerCase().includes(skill.toLowerCase()),
    );

    return {
      questionText: content,
      techSkills: foundSkills,
    };
  }

  /**
   * @description 根据面试问答生成追问问题
   * @param question - 原始面试题
   * @param answer - 面试者的回答
   * @returns Promise<string> - 生成的追问问题
   */
  async generateFollowUp(question: string, answer: string): Promise<string> {
    const prompt = `
基于以下对话生成一个追问问题：

面试官：${question}
面试者：${answer}

要求：
1. 追问要深入挖掘面试者的回答
2. 如果回答不够详细，要求进一步解释
3. 如果回答有漏洞，指出并询问
4. 语言简洁清晰，使用中文提问
    `.trim();

    const result = await this.getResponseContent(prompt);
    return result || '你能再详细解释一下吗？';
  }

  /**
   * @description 对面试回答进行多维度评分
   * @param question - 面试题
   * @param answer - 面试者的回答
   * @param techSkills - 该问题涉及的技术栈列表（用于针对性评分）
   * @returns Promise<EvaluationResult> - 评分结果
   */
  async evaluateAnswer(
    question: string,
    answer: string,
    techSkills: string[] = [],
  ): Promise<EvaluationResult> {
    let techSkillScores: Record<string, number> = {};

    // 如果问题涉及技术栈，则增加技术栈专项评分
    if (techSkills.length > 0) {
      techSkillScores = await this.evaluateTechSkillScores(
        question,
        answer,
        techSkills,
      );
    }

    const prompt = `
请对以下面试回答进行评分（每项 0-100 分）：

问题：${question}
回答：${answer}
${techSkills.length > 0 ? `涉及技术栈：${techSkills.join('、')}` : ''}

评分维度：
1. 技术深度：回答的专业性、技术准确性、对问题本质的理解
2. 表达能力：逻辑清晰度、条理性、语言组织能力
3. 项目经验：是否结合实际项目经验，回答是否具体可信

请按照以下 JSON 格式输出：
{
  "technicalScore": 分数,
  "communicationScore": 分数,
  "experienceScore": 分数,
  "feedback": "简短的评价和建议"
}
    `.trim();

    const result = await this.getResponseContent(prompt);
    if (!result) {
      // 返回默认评分
      return {
        technicalScore: 50,
        communicationScore: 50,
        experienceScore: 50,
        feedback: '无法获取 AI 评价，已使用默认评分',
        averageScore: 50,
        techSkillScores,
      };
    }

    const evaluation = this.parseEvaluation(result);
    evaluation.techSkillScores = techSkillScores;
    return evaluation;
  }

  /**
   * @description 对涉及的技术栈进行专项评分
   * @param question - 面试题
   * @param answer - 面试者的回答
   * @param techSkills - 技术栈列表
   * @returns Promise<Record<string, number>> - 各技术栈评分
   */
  private async evaluateTechSkillScores(
    question: string,
    answer: string,
    techSkills: string[],
  ): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};

    const prompt = `
请针对以下面试回答中涉及的技术栈进行专项评分（每项 0-100 分）：

问题：${question}
回答：${answer}
涉及技术栈：${techSkills.join('、')}

请评估面试者对每个技术栈的掌握程度，按以下 JSON 格式输出：
{
  ${techSkills.map((s) => `"${s}": 分数`).join(',\n  ')}
}

评分标准：
- 90-100：对技术原理有深入理解，能解释底层机制，有实际项目经验
- 70-89：对技术使用熟练，有一定项目经验
- 50-69：了解基本用法，但缺乏深度
- 50 以下：回答不准确或与事实不符
    `.trim();

    const result = await this.getResponseContent(prompt);
    if (!result) {
      // 返回默认评分
      techSkills.forEach((skill) => {
        scores[skill] = 50;
      });
      return scores;
    }

    try {
      const jsonStr = result.match(/\{[\s\S]*\}/);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr[0]);
        techSkills.forEach((skill) => {
          // 尝试多种匹配方式
          const normalizedSkill = skill.toLowerCase();
          const key = Object.keys(parsed).find(
            (k) => k.toLowerCase() === normalizedSkill,
          );
          scores[skill] = key ? parsed[key] : 50;
        });
      }
    } catch (error) {
      console.error('解析技术栈评分失败:', error);
      techSkills.forEach((skill) => {
        scores[skill] = 50;
      });
    }

    return scores;
  }

  /**
   * @description 根据面试记录生成综合评价报告
   * @param questions - 面试问题列表（包含回答和评分）
   * @returns Promise<string> - 综合评价报告
   */
  async generateSummary(
    questions: Array<{
      questionText: string;
      answerText?: string | null;
      technicalScore?: number | null;
      communicationScore?: number | null;
      experienceScore?: number | null;
      feedback?: string | null;
    }>,
  ): Promise<string> {
    // 格式化面试记录
    const questionsText = questions
      .map((q, i) =>
        `
第 ${i + 1} 题：
问题：${q.questionText}
回答：${q.answerText || '未回答'}
评分：技术${q.technicalScore || 0}分，表达${q.communicationScore || 0}分，经验${q.experienceScore || 0}分
反馈：${q.feedback || '无'}
      `.trim(),
      )
      .join('\n\n');

    const prompt = `
请根据以下面试记录生成一份综合评价报告：

${questionsText}

要求：
1. 总结面试者的整体表现
2. 分析优势和不足
3. 给出具体的改进建议
4. 语言简洁专业，使用中文
    `.trim();

    const result = await this.getResponseContent(prompt);
    return result || '面试评价生成失败';
  }

  /**
   * @description 解析 AI 返回的评分 JSON
   * @param content - AI 响应内容
   * @returns EvaluationResult - 解析后的评分结果
   */
  private parseEvaluation(content: string): EvaluationResult {
    try {
      // 提取 JSON 部分
      const jsonStr = content.match(/\{[\s\S]*\}/);
      if (jsonStr) {
        const result = JSON.parse(jsonStr[0]);
        // 计算平均分
        const avgScore = Math.round(
          ((result.technicalScore || 0) +
            (result.communicationScore || 0) +
            (result.experienceScore || 0)) /
            3,
        );
        return {
          technicalScore: result.technicalScore || 0,
          communicationScore: result.communicationScore || 0,
          experienceScore: result.experienceScore || 0,
          feedback: result.feedback || '',
          averageScore: avgScore,
        };
      }
    } catch (error) {
      console.error('解析评价结果失败:', error);
    }

    // 解析失败时返回默认值
    return {
      technicalScore: 50,
      communicationScore: 50,
      experienceScore: 50,
      feedback: '评分解析失败，使用默认值',
      averageScore: 50,
    };
  }

  /**
   * @description 从简历文本中提取技能关键词
   * @param resumeText - 简历文本
   * @returns string[] - 提取到的技能列表（最多 5 个）
   */
  private extractSkillsFromResume(resumeText: string): string[] {
    // 常见技术技能关键词
    const skillPatterns = [
      'React',
      'Vue',
      'Angular',
      'Next.js',
      'Nuxt',
      'Node.js',
      'Express',
      'Nest.js',
      'Spring',
      'Django',
      'TypeScript',
      'JavaScript',
      'Python',
      'Java',
      'Go',
      'MySQL',
      'PostgreSQL',
      'MongoDB',
      'Redis',
      'AWS',
      'Docker',
      'Kubernetes',
      'Git',
      'HTML',
      'CSS',
      'Tailwind',
      'GraphQL',
    ];

    const foundSkills: string[] = [];
    const lowerText = resumeText.toLowerCase();

    // 遍历匹配技能关键词
    skillPatterns.forEach((skill) => {
      if (lowerText.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });

    return foundSkills.slice(0, 5);
  }

  /**
   * @description 生成备用面试题（当 AI 调用失败时使用）
   * @param questionCount - 题目序号
   * @returns string - 备用面试题
   */
  private generateFallbackQuestion(questionCount: number): string {
    const fallbackQuestions = [
      '请介绍一下你最擅长的技术栈？',
      '你在最近的项目中遇到过什么技术难题，是如何解决的？',
      '请描述一个你参与的最有挑战性的项目？',
      '你如何学习新技术？举个例子说明。',
      '你对未来的技术发展有什么看法？',
    ];
    return fallbackQuestions[(questionCount - 1) % fallbackQuestions.length];
  }
}
