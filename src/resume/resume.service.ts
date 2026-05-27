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
   */
  async parsePdf(buffer: Buffer): Promise<string> {
    // 检查是否是有效的 PDF 文件（PDF 文件头是 %PDF-）
    const pdfHeader = buffer.toString('ascii', 0, 5);
    if (pdfHeader !== '%PDF-') {
      // 如果不是 PDF，直接返回空字符串或尝试作为纯文本处理
      return buffer.toString('utf-8').substring(0, 2000) || '';
    }

    try {
      const data = await (pdfParse as any).default(buffer);
      return data.text || '';
    } catch (error) {
      console.error('PDF 解析失败:', error);
      // 解析失败时返回空字符串，避免导致 500 错误
      return '';
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
      'Rust',
      'MySQL',
      'PostgreSQL',
      'MongoDB',
      'Redis',
      'SQLite',
      'AWS',
      'Docker',
      'Kubernetes',
      'Git',
      'Webpack',
      'HTML',
      'CSS',
      'SASS',
      'Tailwind',
      'Webpack',
      'REST',
      'GraphQL',
      'gRPC',
      'Websocket',
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
