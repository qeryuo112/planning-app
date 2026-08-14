import {
  PlanHabit,
  PlanMilestone,
  PlanTask,
} from "../plan-orchestrator.service";

export interface UserHistoryHint {
  goalTitles: string[];
  completedGoalTitles: string[];
  /**
   * 每个关键词对应的加权完成率（0-1）。
   * 例如 { "减脂": 0.85 } 表示用户历史上与减脂相关目标的完成率为 85%。
   */
  completionRateByKeyword: Record<string, number>;
}

export interface AITemplate {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  defaultPlanDuration: number;
  defaultStageLength: number;
  basePrompt: string;
  defaultMilestones: PlanMilestone[];
  defaultTasks: PlanTask[];
  defaultHabits: PlanHabit[];
  assumptions: string[];
  warnings: string[];
}

export const AI_TEMPLATES: AITemplate[] = [
  {
    id: "postgraduate-english",
    name: "考研英语",
    category: "语言学习",
    keywords: [
      "考研英语",
      "英语一",
      "英语二",
      "研究生英语",
      "考研",
      "gre",
      "gmat",
      "ielts",
      "toefl",
      "雅思",
      "托福",
      "英语考试",
      "英语复习",
      "英语备考",
      "四六级",
      "cet",
    ],
    defaultPlanDuration: 180,
    defaultStageLength: 30,
    basePrompt: `用户正在备考研究生英语。请制定一个以真题训练为核心、兼顾词汇与长难句的复习计划。`,
    defaultMilestones: [
      { title: "词汇与长难句基础", weight: 0.3 },
      { title: "阅读理解专项突破", weight: 0.35 },
      { title: "真题模拟与写作", weight: 0.35 },
    ],
    defaultTasks: [
      {
        title: "背诵考研核心词汇 50 个",
        durationMinutes: 30,
        energyLevel: "medium",
      },
      {
        title: "精读 1 篇阅读理解真题",
        durationMinutes: 40,
        energyLevel: "high",
      },
      {
        title: "完成 1 道长难句翻译",
        durationMinutes: 20,
        energyLevel: "low",
      },
      {
        title: "抄写并背诵 1 篇作文模板",
        durationMinutes: 30,
        energyLevel: "medium",
      },
    ],
    defaultHabits: [
      {
        title: "每日背单词",
        frequency: "daily",
        preferredTime: "08:00",
        energyLevel: "medium",
      },
      {
        title: "睡前复盘 1 篇阅读",
        frequency: "daily",
        preferredTime: "22:00",
        energyLevel: "low",
      },
    ],
    assumptions: [
      "用户每天有 40-60 分钟可投入英语复习",
      "用户具备一定的英语基础，需聚焦考研题型",
    ],
    warnings: [
      "真题数量有限，建议精做而非泛做",
      "作文模板需自行改写，避免雷同",
    ],
  },
  {
    id: "fat-loss",
    name: "减脂入门",
    category: "健康",
    keywords: [
      "减脂",
      "减肥",
      "瘦",
      "体重",
      "燃脂",
      "减重",
      "lose weight",
      "fat loss",
      "体脂",
      "瘦身",
      "控制饮食",
      "热量缺口",
    ],
    defaultPlanDuration: 90,
    defaultStageLength: 30,
    basePrompt: `用户希望健康减脂。请制定一个结合饮食、有氧与力量训练的计划，强调可持续而非极端节食。`,
    defaultMilestones: [
      { title: "建立运动习惯", weight: 0.35 },
      { title: "饮食记录与热量缺口", weight: 0.35 },
      { title: "进阶训练与体型塑造", weight: 0.3 },
    ],
    defaultTasks: [
      {
        title: "记录当日三餐与热量",
        durationMinutes: 10,
        energyLevel: "low",
      },
      {
        title: "完成 30 分钟有氧训练",
        durationMinutes: 30,
        energyLevel: "medium",
      },
      {
        title: "完成 20 分钟自重力量训练",
        durationMinutes: 20,
        energyLevel: "high",
      },
      {
        title: "称体重并记录身体围度",
        durationMinutes: 5,
        energyLevel: "low",
      },
    ],
    defaultHabits: [
      {
        title: "每日饮水 2L",
        frequency: "daily",
        preferredTime: "09:00",
        energyLevel: "low",
      },
      {
        title: "睡前拉伸 10 分钟",
        frequency: "daily",
        preferredTime: "22:00",
        energyLevel: "low",
      },
    ],
    assumptions: [
      "用户没有运动伤病，可进行中低强度训练",
      "用户有条件进行户外步行或居家训练",
    ],
    warnings: [
      "减脂速度建议每周 0.5-1% 体重，避免过度节食",
      "出现关节疼痛需立即停止并就医",
    ],
  },
  {
    id: "morning-routine",
    name: "晨间习惯",
    category: "习惯",
    keywords: [
      "晨间",
      "早起",
      "早上",
      "morning routine",
      "自律",
      "晨跑",
      "晨练",
      "起床",
      "清晨",
      "morning",
      "早安",
    ],
    defaultPlanDuration: 30,
    defaultStageLength: 7,
    basePrompt: `用户希望建立一套可持续的晨间习惯。请制定一个温和的早起与晨间流程计划。`,
    defaultMilestones: [
      { title: "稳定早起时间", weight: 0.4 },
      { title: "完成晨间核心流程", weight: 0.4 },
      { title: "固化习惯并优化", weight: 0.2 },
    ],
    defaultTasks: [
      {
        title: "起床后喝 1 杯温水",
        durationMinutes: 5,
        energyLevel: "low",
      },
      {
        title: "5 分钟拉伸或冥想",
        durationMinutes: 5,
        energyLevel: "low",
      },
      {
        title: "阅读或写作 15 分钟",
        durationMinutes: 15,
        energyLevel: "medium",
      },
      {
        title: "列出今日最重要的 3 件事",
        durationMinutes: 10,
        energyLevel: "medium",
      },
    ],
    defaultHabits: [
      {
        title: "固定时间起床",
        frequency: "daily",
        preferredTime: "07:00",
        energyLevel: "low",
      },
      {
        title: "晨间阅读",
        frequency: "daily",
        preferredTime: "07:30",
        energyLevel: "medium",
      },
    ],
    assumptions: ["用户希望早起但不需要极端时间", "晨间活动以低强度为主"],
    warnings: [
      "建议每周比当前起床时间提前 15 分钟，避免突然改变",
      "睡眠不足时优先保证睡眠时长",
    ],
  },
  {
    id: "reading-plan",
    name: "阅读计划",
    category: "自我提升",
    keywords: [
      "阅读",
      "读书",
      "看书",
      "读完",
      "书单",
      "read",
      "reading",
      "读书笔记",
      "阅读计划",
      "读书计划",
      "学习",
    ],
    defaultPlanDuration: 90,
    defaultStageLength: 30,
    basePrompt: `用户希望养成阅读习惯并完成一定量的书籍。请制定一个包含阅读、笔记与复述的渐进计划。`,
    defaultMilestones: [
      { title: "选书与阅读节奏", weight: 0.3 },
      { title: "养成每日阅读习惯", weight: 0.4 },
      { title: "输出读书笔记与行动清单", weight: 0.3 },
    ],
    defaultTasks: [
      {
        title: "阅读 30 分钟",
        durationMinutes: 30,
        energyLevel: "medium",
      },
      {
        title: "记录 1 条书摘或感悟",
        durationMinutes: 15,
        energyLevel: "low",
      },
      {
        title: "整理本周阅读笔记",
        durationMinutes: 30,
        energyLevel: "medium",
      },
      {
        title: "将书中方法应用到 1 个场景",
        durationMinutes: 20,
        energyLevel: "medium",
      },
    ],
    defaultHabits: [
      {
        title: "每日阅读",
        frequency: "daily",
        preferredTime: "21:00",
        energyLevel: "medium",
      },
      {
        title: "周末写读书总结",
        frequency: "weekly",
        preferredTime: "10:00",
        energyLevel: "medium",
      },
    ],
    assumptions: ["用户有明确的阅读目标或书单", "每天可投入 30-45 分钟阅读"],
    warnings: [
      "阅读计划需配合输出，否则容易遗忘",
      "难度过高的书籍应拆分到多阶段",
    ],
  },
  {
    id: "japanese-beginner",
    name: "日语入门",
    category: "语言学习",
    keywords: [
      "日语",
      "日文",
      "日本语",
      "五十音",
      "JLPT",
      "japanese",
      "日语入门",
      "日语学习",
      "日语能力考",
      "n5",
      "n4",
      "n3",
      "n2",
      "n1",
    ],
    defaultPlanDuration: 90,
    defaultStageLength: 30,
    basePrompt: `用户正在学习日语入门。请制定一个从五十音、基础语法到日常会话的循序渐进计划。`,
    defaultMilestones: [
      { title: "五十音与发音", weight: 0.3 },
      { title: "基础语法与句型", weight: 0.35 },
      { title: "日常会话与听力", weight: 0.35 },
    ],
    defaultTasks: [
      {
        title: "学习 10 个新单词与例句",
        durationMinutes: 20,
        energyLevel: "medium",
      },
      {
        title: "完成 1 课语法练习",
        durationMinutes: 25,
        energyLevel: "high",
      },
      {
        title: "听写 1 段 N5 听力",
        durationMinutes: 15,
        energyLevel: "medium",
      },
      {
        title: "朗读 5 句例句并录音",
        durationMinutes: 10,
        energyLevel: "low",
      },
    ],
    defaultHabits: [
      {
        title: "每日背单词",
        frequency: "daily",
        preferredTime: "08:00",
        energyLevel: "medium",
      },
      {
        title: "日语听力 10 分钟",
        frequency: "daily",
        preferredTime: "21:00",
        energyLevel: "low",
      },
    ],
    assumptions: ["用户零基础，从五十音开始", "每天可投入 30-50 分钟学习"],
    warnings: [
      "五十音阶段不要急于求成，需反复巩固",
      "听力训练应优先可理解输入",
    ],
  },
  {
    id: "running-5k",
    name: "5 公里跑步",
    category: "健康",
    keywords: [
      "跑步",
      "5k",
      "5公里",
      "马拉松",
      "慢跑",
      "run",
      "running",
      "晨跑",
      "夜跑",
      "长跑",
      "配速",
      "公里跑",
      "十公里",
      "半程马拉松",
    ],
    defaultPlanDuration: 60,
    defaultStageLength: 14,
    basePrompt: `用户希望安全地跑完 5 公里。请制定一个从低强度步行/慢跑交替到持续 5 公里的训练计划。`,
    defaultMilestones: [
      { title: "建立跑步习惯", weight: 0.4 },
      { title: "持续慢跑 3 公里", weight: 0.3 },
      { title: "完成 5 公里", weight: 0.3 },
    ],
    defaultTasks: [
      {
        title: "动态热身 5 分钟",
        durationMinutes: 5,
        energyLevel: "low",
      },
      {
        title: "完成当日跑步训练",
        durationMinutes: 30,
        energyLevel: "high",
      },
      {
        title: "跑后拉伸 10 分钟",
        durationMinutes: 10,
        energyLevel: "low",
      },
      {
        title: "记录跑步距离与心率",
        durationMinutes: 5,
        energyLevel: "low",
      },
    ],
    defaultHabits: [
      {
        title: "每周 3 次跑步",
        frequency: "weekly",
        preferredTime: "07:00",
        energyLevel: "high",
      },
      {
        title: "跑后拉伸",
        frequency: "weekly",
        preferredTime: "07:40",
        energyLevel: "low",
      },
    ],
    assumptions: ["用户身体健康，可进行中低强度运动", "用户有跑步场地或跑步机"],
    warnings: [
      "跑步强度需循序渐进，避免膝盖受伤",
      "天气炎热时建议清晨或傍晚训练",
    ],
  },
];

export function findTemplateById(id?: string): AITemplate | undefined {
  return AI_TEMPLATES.find((t) => t.id === id);
}

export function recommendTemplate(
  input: string,
  userHistory?: UserHistoryHint,
): AITemplate | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase();
  let best: AITemplate | undefined;
  let bestScore = 0;
  for (const template of AI_TEMPLATES) {
    const keywordScore = template.keywords.filter((k) =>
      lower.includes(k),
    ).length;

    let historyScore = 0;
    if (userHistory && userHistory.goalTitles.length > 0) {
      for (const keyword of template.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        const everMatched = userHistory.goalTitles.some((title) =>
          title.toLowerCase().includes(lowerKeyword),
        );
        if (everMatched) {
          historyScore += 1;
        }
        const completedMatched = userHistory.completedGoalTitles.some((title) =>
          title.toLowerCase().includes(lowerKeyword),
        );
        if (completedMatched) {
          historyScore += 2;
        }
        const rate = userHistory.completionRateByKeyword[keyword];
        if (rate !== undefined && rate >= 0.7) {
          historyScore += 1;
        }
      }
    }

    const score = keywordScore + historyScore;
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return bestScore > 0 ? best : undefined;
}

export function listTemplates(): AITemplate[] {
  return AI_TEMPLATES;
}
