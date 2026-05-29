-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resumeText" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "extractedTechSkills" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "techSkills" TEXT NOT NULL DEFAULT '[]',
    "answerText" TEXT,
    "technicalScore" INTEGER,
    "communicationScore" INTEGER,
    "experienceScore" INTEGER,
    "techSkillScores" TEXT NOT NULL DEFAULT '{}',
    "feedback" TEXT,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
