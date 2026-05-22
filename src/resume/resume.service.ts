/**
 * @file resume.service.ts
 * @description 简历处理服务，负责 PDF 解析和技能提取
 */

import { Injectable } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

/**
 * @class ResumeService
 * @description 简历解析服务类
 */
@Injectable()
export class ResumeService {
  /**
   * @description 解析 PDF 文件并提取文本内容
   * @param buffer - PDF 文件的 Buffer 数据
   * @returns Promise<string> - 提取的文本内容
   * @throws Error - PDF 解析失败时抛出异常
   */
  async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const data = await (pdfParse as any).default(buffer);
      return data.text || '';
    } catch (error) {
      throw new Error(`PDF 解析失败: ${error.message}`);
    }
  }

  /**
   * @description 从简历文本中提取技术技能关键词
   * @param resumeText - 简历文本内容
   * @returns string[] - 提取到的技能列表（去重）
   */
  extractSkills(resumeText: string): string[] {
    // 常见技术技能关键词列表
    const skillPatterns = [
      'React', 'Vue', 'Angular', 'Next.js', 'Nuxt',
      'Node.js', 'Express', 'Nest.js', 'Spring', 'Django',
      'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust',
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite',
      'AWS', 'Docker', 'Kubernetes', 'Git', 'Webpack',
      'HTML', 'CSS', 'SASS', 'Tailwind', 'Webpack',
      'REST', 'GraphQL', 'gRPC', 'Websocket'
    ];

    const foundSkills: string[] = [];
    const lowerText = resumeText.toLowerCase();

    // 遍历匹配技能关键词
    skillPatterns.forEach((skill) => {
      const regex = new RegExp(skill.toLowerCase().replace(/\./g, '\\.'), 'g');
      if (regex.test(lowerText)) {
        foundSkills.push(skill);
      }
    });

    // 去重返回
    return [...new Set(foundSkills)];
  }
}