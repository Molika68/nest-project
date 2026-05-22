# AI Mock Interviewer - 项目文档

## 1. 项目一句话描述

一个基于 AI 的模拟面试应用。用户上传简历后，AI 自动生成面试题并根据回答追问，
最终给出评价和技能雷达图。

## 2. 核心用户流程

1. 用户访问首页，上传简历 PDF
2. 进入面试页，AI 根据简历生成第一道面试题（流式显示）
3. 用户在输入框打字回答，点击提交
4. AI 分析回答，给出追问或进入下一题
5. 面试结束（5 题后或用户主动结束），跳转结果页
6. 结果页用 ECharts 展示技能雷达图 + 面试记录回顾

## 3. 技术栈

- 前端：Next.js (SSR) + TypeScript + ECharts
- 后端：Nest.js + Prisma + SQLite (本地开发) / Turso (上线)
- AI：LangChain.js + Ollama (本地开发) / DeepSeek (上线)
- AI 编程辅助：Cursor / Copilot / TRAE

## 4. 页面与路由

| 页面   | 路由         | SSR/CSR | 说明                  |
| ------ | ------------ | ------- | --------------------- |
| 首页   | /            | CSR     | 上传简历、开始面试    |
| 面试页 | /interview   | SSR     | 对话界面，预取第一题  |
| 结果页 | /result/[id] | SSR     | 技能雷达图 + 面试记录 |

## 5. 后端 API 设计

| 接口                      | 方法 | 说明                           |
| ------------------------- | ---- | ------------------------------ |
| /api/interview/start      | POST | 上传简历，创建面试，返回第一题 |
| /api/interview/answer     | POST | 提交回答，返回追问或下一题     |
| /api/interview/result/:id | GET  | 获取面试结果（评分 + 评价）    |

## 6. 数据库模型

- Interview：id, status, createdAt, updatedAt
- Question：id, interviewId, questionText, answerText, score, feedback
  （使用 Prisma + SQLite，本地开发无需额外安装）

## 7. Agent 核心逻辑

- 工具1：简历检索工具（基于 RAG，搜索简历中的技能和项目）
- 工具2：题库生成工具（根据技能关键词生成对应面试题）
- 追问策略：回答评分低于 60 分则追问一次；连续两次低分则跳过
- 评分维度：技术深度、表达能力、项目经验（每个维度 0-100）
- 最终输出：各维度评分 + 简短文字评价 + 下一题

## 8. 约束条件

- 本地开发使用 Ollama + qwen2.5-64k，零成本
- 上线时通过环境变量切换到 DeepSeek
- 注意：模型调用成本极低，但开发阶段避免频繁调用大模型
