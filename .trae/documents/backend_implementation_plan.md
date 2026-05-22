# AI Mock Interviewer - 后端实现计划

## 项目概述

基于 Nest.js 的 AI 模拟面试后端服务，提供简历解析、面试题生成、回答评分等核心功能。

## 技术栈

- **框架**: Nest.js 10.x
- **语言**: TypeScript
- **数据库**: Prisma + SQLite
- **AI**: LangChain.js + Ollama (本地) / DeepSeek (上线)

---

## 模块拆分与实现步骤

### 模块 1：项目初始化与 Prisma 配置

**目标**: 配置 Prisma ORM 并创建数据库模型

**涉及文件**:
- `prisma/schema.prisma` - 数据库 schema
- `.env` - 环境变量
- `src/app.module.ts` - 集成 PrismaModule

**核心代码逻辑**:

```prisma
// schema.prisma
model Interview {
  id          String     @id @default(uuid())
  resumeText  String     // 解析后的简历文本
  status      String     // "active" | "completed"
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  questions   Question[]
}

model Question {
  id                 String    @id @default(uuid())
  interviewId        String
  interview          Interview @relation(fields: [interviewId], references: [id])
  questionText       String    // 面试题文本
  answerText         String?   // 用户回答
  technicalScore     Int?      // 技术深度得分 (0-100)
  communicationScore Int?      // 表达能力得分 (0-100)
  experienceScore    Int?      // 项目经验得分 (0-100)
  feedback           String?   // AI 评价反馈
  followUpCount      Int       @default(0)
  isCompleted        Boolean   @default(false)
  createdAt          DateTime  @default(now())
}
```

**执行步骤**:
1. 初始化 Prisma: `npx prisma init`
2. 配置 `.env` 中的 `DATABASE_URL`
3. 创建 schema.prisma 文件
4. 运行迁移: `npx prisma db push`

---

### 模块 2：简历处理服务

**目标**: 实现 PDF 简历解析功能

**涉及文件**:
- `src/resume/resume.service.ts` - 简历解析服务
- `src/resume/resume.module.ts` - 简历模块

**核心代码逻辑**:

```typescript
// resume.service.ts
@Injectable()
export class ResumeService {
  async parsePdf(buffer: Buffer): Promise<string> {
    // 使用 pdf-parse 提取文本
    const data = await pdfParse(buffer);
    return data.text;
  }
  
  extractSkills(resumeText: string): string[] {
    // 从简历中提取技术技能关键词
    // 使用正则或 AI 分析
    const skills = ['React', 'Node.js', 'TypeScript', 'Python'];
    return skills;
  }
}
```

**依赖**: `pdf-parse`

---

### 模块 3：AI Agent 服务

**目标**: 实现面试题生成和回答评分功能

**涉及文件**:
- `src/ai/ai.service.ts` - AI 主服务
- `src/ai/ai.module.ts` - AI 模块
- `src/ai/tools/resume-retrieval.tool.ts` - 简历检索工具
- `src/ai/tools/question-generator.tool.ts` - 题库生成工具

**核心代码逻辑**:

```typescript
// ai.service.ts
@Injectable()
export class AiService {
  private llm: BaseChatModel;
  
  constructor() {
    // 根据环境变量选择 Ollama 或 DeepSeek
    this.llm = this.createLlm();
  }
  
  async generateQuestion(resumeText: string, questionCount: number): Promise<string> {
    // 提示词：根据简历生成面试题
    const prompt = `根据以下简历内容生成第 ${questionCount} 道面试题：\n${resumeText}`;
    const response = await this.llm.invoke(prompt);
    return response.content;
  }
  
  async evaluateAnswer(question: string, answer: string): Promise<EvaluationResult> {
    // 提示词：评估回答并给出评分
    const prompt = `请从以下维度评分（0-100）：
    问题：${question}
    回答：${answer}
    评分维度：技术深度、表达能力、项目经验`;
    const response = await this.llm.invoke(prompt);
    // 解析评分结果
    return this.parseEvaluation(response.content);
  }
}
```

**依赖**: `@langchain/core`, `@langchain/community`, `langchain`

---

### 模块 4：面试核心服务

**目标**: 实现面试流程管理

**涉及文件**:
- `src/interview/interview.service.ts` - 面试服务
- `src/interview/interview.module.ts` - 面试模块

**核心代码逻辑**:

```typescript
// interview.service.ts
@Injectable()
export class InterviewService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private resumeService: ResumeService
  ) {}
  
  async startInterview(fileBuffer: Buffer): Promise<StartInterviewResponse> {
    // 1. 解析简历
    const resumeText = await this.resumeService.parsePdf(fileBuffer);
    
    // 2. 创建面试记录
    const interview = await this.prisma.interview.create({
      data: { resumeText, status: 'active' }
    });
    
    // 3. 生成第一道题
    const questionText = await this.aiService.generateQuestion(resumeText, 1);
    
    // 4. 创建问题记录
    const question = await this.prisma.question.create({
      data: { interviewId: interview.id, questionText }
    });
    
    return { interviewId: interview.id, question };
  }
  
  async submitAnswer(interviewId: string, answer: string): Promise<SubmitAnswerResponse> {
    // 1. 获取当前未完成的问题
    const currentQuestion = await this.prisma.question.findFirst({
      where: { interviewId, isCompleted: false }
    });
    
    // 2. 评估回答
    const evaluation = await this.aiService.evaluateAnswer(
      currentQuestion.questionText, 
      answer
    );
    
    // 3. 更新问题记录
    await this.prisma.question.update({
      where: { id: currentQuestion.id },
      data: { 
        answerText: answer,
        technicalScore: evaluation.technicalScore,
        communicationScore: evaluation.communicationScore,
        experienceScore: evaluation.experienceScore,
        feedback: evaluation.feedback,
        followUpCount: currentQuestion.followUpCount + 1
      }
    });
    
    // 4. 判断是否追问或进入下一题
    if (evaluation.averageScore < 60 && currentQuestion.followUpCount < 2) {
      // 生成追问
      const followUpQuestion = await this.aiService.generateFollowUp(
        currentQuestion.questionText, 
        answer
      );
      return { type: 'followup', question: followUpQuestion };
    }
    
    // 5. 检查是否完成 5 题
    const questionCount = await this.prisma.question.count({ where: { interviewId } });
    if (questionCount >= 5) {
      await this.prisma.interview.update({ 
        where: { id: interviewId }, 
        data: { status: 'completed' }
      });
      return { type: 'finished' };
    }
    
    // 6. 生成下一题
    const interview = await this.prisma.interview.findUnique({ where: { id: interviewId } });
    const nextQuestion = await this.aiService.generateQuestion(
      interview.resumeText, 
      questionCount + 1
    );
    
    await this.prisma.question.create({
      data: { interviewId, questionText: nextQuestion }
    });
    
    return { type: 'next', question: nextQuestion };
  }
  
  async getResult(interviewId: string): Promise<InterviewResult> {
    // 1. 获取所有问题
    const questions = await this.prisma.question.findMany({
      where: { interviewId },
      orderBy: { createdAt: 'asc' }
    });
    
    // 2. 计算平均分
    const avgTechnical = this.calculateAverage(questions.map(q => q.technicalScore));
    const avgCommunication = this.calculateAverage(questions.map(q => q.communicationScore));
    const avgExperience = this.calculateAverage(questions.map(q => q.experienceScore));
    
    // 3. 生成综合评价
    const summary = await this.aiService.generateSummary(questions);
    
    return {
      technicalScore: avgTechnical,
      communicationScore: avgCommunication,
      experienceScore: avgExperience,
      summary,
      questions
    };
  }
}
```

---

### 模块 5：API 控制器

**目标**: 实现 REST API 端点

**涉及文件**:
- `src/interview/interview.controller.ts` - 面试控制器
- `src/interview/dto/start-interview.dto.ts` - 请求 DTO
- `src/interview/dto/submit-answer.dto.ts` - 请求 DTO

**核心代码逻辑**:

```typescript
// interview.controller.ts
@Controller('api/interview')
export class InterviewController {
  constructor(private interviewService: InterviewService) {}
  
  @Post('start')
  @UseInterceptors(FileInterceptor('resume'))
  async startInterview(@UploadedFile() file: Express.Multer.File) {
    return this.interviewService.startInterview(file.buffer);
  }
  
  @Post('answer')
  async submitAnswer(@Body() dto: SubmitAnswerDto) {
    return this.interviewService.submitAnswer(dto.interviewId, dto.answer);
  }
  
  @Get('result/:id')
  async getResult(@Param('id') id: string) {
    return this.interviewService.getResult(id);
  }
}
```

**API 端点**:

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/interview/start` | POST | 上传简历，创建面试，返回第一题 |
| `/api/interview/answer` | POST | 提交回答，返回追问或下一题 |
| `/api/interview/result/:id` | GET | 获取面试结果 |

---

### 模块 6：异常处理与配置

**目标**: 配置全局异常处理和环境变量

**涉及文件**:
- `src/config/configuration.ts` - 配置加载
- `src/common/filters/http-exception.filter.ts` - 异常过滤器

---

## 依赖清单

| 依赖 | 版本 | 用途 |
|------|------|------|
| `@nestjs/common` | ^10.0.0 | Nest.js 核心 |
| `@nestjs/platform-express` | ^10.0.0 | Express 适配器 |
| `@prisma/client` | ^5.0.0 | Prisma ORM |
| `prisma` | ^5.0.0 | Prisma CLI |
| `@langchain/core` | ^0.1.0 | LangChain 核心 |
| `@langchain/community` | ^0.1.0 | LangChain 社区工具 |
| `langchain` | ^0.1.0 | LangChain 主包 |
| `pdf-parse` | ^1.1.1 | PDF 解析 |
| `class-validator` | ^0.14.0 | DTO 验证 |
| `class-transformer` | ^0.5.1 | 类型转换 |
| `multer` | ^1.4.5 | 文件上传 |

---

## 环境变量配置

```bash
# .env
DATABASE_URL="file:./dev.db"
AI_PROVIDER="ollama"          # ollama 或 deepseek
OLLAMA_MODEL="qwen2.5-64k"
DEEPSEEK_API_KEY="your-key"
PORT=3000
```

---

## 测试与验证

**测试步骤**:
1. 启动服务: `pnpm run start:dev`
2. 使用 curl 测试 API:
   ```bash
   # 上传简历开始面试
   curl -X POST http://localhost:3000/api/interview/start \
     -F "resume=@resume.pdf"
   
   # 提交回答
   curl -X POST http://localhost:3000/api/interview/answer \
     -H "Content-Type: application/json" \
     -d '{"interviewId": "xxx", "answer": "我的回答"}'
   
   # 获取结果
   curl http://localhost:3000/api/interview/result/xxx
   ```

---

## 安全注意事项

1. 文件上传大小限制（建议 5MB）
2. 输入验证和清理
3. 异常捕获和错误日志
4. API 限流（可选）
5. CORS 配置