import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

interface TaskWithScore {
  id: string;
  title: string;
  scheduledDate: string | null;
  energyLevel: string;
  durationMinutes: number | null;
  status: string;
  weight: number;
  milestoneTitle: string | null;
  projectTitle: string | null;
  isOverdue: boolean;
  score: number;
}

interface HabitToday {
  id: string;
  title: string;
  frequency: string;
  preferredTime: string | null;
  energyLevel: string;
  checkedToday: boolean;
  currentStreak: number;
  longestStreak: number;
}

interface GoalToday {
  id: string;
  title: string;
  horizon: string;
  progress: number;
  currentStreak: number;
  milestones: Array<{ id: string; title: string; progress: number }>;
}

export interface TodaySummary {
  date: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  topTasks: TaskWithScore[];
  habits: HabitToday[];
  goals: GoalToday[];
}

/**
 * 今日视图服务
 * 聚合当天任务、习惯打卡、目标进度与连续打卡数据。
 */
@Injectable()
export class TodayService {
  private readonly logger = new Logger(TodayService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async getToday(userId: string, dateInput?: string): Promise<TodaySummary> {
    const date = dateInput
      ? new Date(`${dateInput}T00:00:00.000Z`)
      : new Date();
    const todayKey = this.toDateKey(date);

    this.logger.debug(`获取今日视图: user=${userId}, date=${todayKey}`);

    const [tasks, habits, goals] = await Promise.all([
      this.fetchTasks(userId, date),
      this.fetchHabits(userId, date),
      this.fetchGoals(userId),
    ]);

    const scoredTasks = tasks.map((task) => {
      const taskDate = task.scheduledDate
        ? this.toDateKey(task.scheduledDate)
        : null;
      const isOverdue =
        taskDate !== null &&
        taskDate < todayKey &&
        task.status !== "done" &&
        task.status !== "skipped";

      return {
        id: task.id,
        title: task.title,
        scheduledDate: taskDate,
        energyLevel: task.energyLevel,
        durationMinutes: task.durationMinutes,
        status: task.status,
        weight: task.weight || 1,
        milestoneTitle: task.milestone?.title ?? null,
        projectTitle: task.project?.title ?? null,
        isOverdue,
        score: this.scoreTask(task, isOverdue),
      };
    });

    scoredTasks.sort((a, b) => b.score - a.score);

    const topTasks = scoredTasks.slice(0, 3);
    const doneTasks = scoredTasks.filter((t) => t.status === "done").length;
    const overdueTasks = scoredTasks.filter((t) => t.isOverdue).length;

    return {
      date: todayKey,
      totalTasks: scoredTasks.length,
      doneTasks,
      overdueTasks,
      topTasks,
      habits,
      goals,
    };
  }

  private async fetchTasks(
    userId: string,
    date: Date,
  ): Promise<
    Array<{
      id: string;
      title: string;
      scheduledDate: Date | null;
      energyLevel: string;
      durationMinutes: number | null;
      status: string;
      weight: number;
      milestone: { title: string } | null;
      project: { title: string } | null;
    }>
  > {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const todayTasks = await this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { gte: start, lte: end },
        status: { not: "skipped" },
      },
      include: {
        milestone: { select: { title: true } },
        project: { select: { title: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const overdueTasks = await this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { lt: start },
        status: { in: ["todo", "postponed"] },
      },
      include: {
        milestone: { select: { title: true } },
        project: { select: { title: true } },
      },
      orderBy: [{ scheduledDate: "asc" }],
    });

    return [...todayTasks, ...overdueTasks];
  }

  private async fetchHabits(userId: string, date: Date): Promise<HabitToday[]> {
    const habits = await this.prisma.habit.findMany({
      where: { userId },
      include: { checkins: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "desc" },
    });

    const dateKey = this.toDateKey(date);

    return habits.map((habit) => {
      const checkedToday = habit.checkins.some(
        (c) =>
          this.toDateKey(c.date) === dateKey &&
          (c.result === "completed" || c.result === "partial"),
      );

      const { currentStreak, longestStreak } = this.computeStreak(
        habit.checkins,
        date,
      );

      return {
        id: habit.id,
        title: habit.title,
        frequency: habit.frequency,
        preferredTime: habit.preferredTime,
        energyLevel: habit.energyLevel,
        checkedToday,
        currentStreak,
        longestStreak,
      };
    });
  }

  private async fetchGoals(userId: string): Promise<GoalToday[]> {
    const goals = await this.prisma.goal.findMany({
      where: { userId, status: { not: "completed" } },
      include: {
        milestones: { include: { tasks: { include: { checkins: true } } } },
        projects: { include: { tasks: { include: { checkins: true } } } },
        goalLinks: { include: { habit: { include: { checkins: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return goals.map((goal) => {
      const allTasks = [
        ...goal.milestones.flatMap((m) => m.tasks),
        ...goal.projects.flatMap((p) => p.tasks),
      ];

      const milestoneProgresses = goal.milestones.map((milestone) => {
        const tasks = milestone.tasks;
        if (tasks.length === 0) {
          return { id: milestone.id, title: milestone.title, progress: 0 };
        }
        const totalWeight = tasks.reduce(
          (sum, task) => sum + (task.weight || 1),
          0,
        );
        const doneWeight = tasks
          .filter((task) => task.status === "done")
          .reduce((sum, task) => sum + (task.weight || 1), 0);
        return {
          id: milestone.id,
          title: milestone.title,
          progress: totalWeight === 0 ? 0 : doneWeight / totalWeight,
        };
      });

      const totalMilestoneWeight = goal.milestones.reduce(
        (sum, m) => sum + (m.weight || 1),
        0,
      );
      const progress =
        totalMilestoneWeight === 0
          ? 0
          : goal.milestones.reduce((sum, milestone, index) => {
              const milestoneProgress =
                milestoneProgresses[index]?.progress || 0;
              return sum + milestoneProgress * (milestone.weight || 1);
            }, 0) / totalMilestoneWeight;

      const allCheckins = [
        ...allTasks.flatMap((t) => t.checkins),
        ...goal.goalLinks.flatMap((l) => l.habit.checkins),
      ];

      const currentStreak = this.computeGoalStreak(allCheckins);

      return {
        id: goal.id,
        title: goal.title,
        horizon: goal.horizon,
        progress: Number(progress.toFixed(4)),
        currentStreak,
        milestones: milestoneProgresses.map((m) => ({
          ...m,
          progress: Number(m.progress.toFixed(4)),
        })),
      };
    });
  }

  private scoreTask(
    task: {
      energyLevel: string;
      weight: number;
      status: string;
      durationMinutes: number | null;
    },
    isOverdue: boolean,
  ): number {
    let score = 0;

    if (isOverdue) score += 100;
    if (task.status === "done") score -= 1000;

    const energyScore =
      task.energyLevel === "high" ? 3 : task.energyLevel === "medium" ? 2 : 1;
    score += energyScore * 10;

    score += (task.weight || 1) * 5;

    if (task.durationMinutes && task.durationMinutes <= 30) score += 5;

    return score;
  }

  private computeStreak(
    checkins: Array<{ date: Date; result: string }>,
    endDate: Date,
  ): { currentStreak: number; longestStreak: number } {
    const dateMap = new Map<string, boolean>();
    for (const c of checkins) {
      const key = this.toDateKey(c.date);
      const done = c.result === "completed" || c.result === "partial";
      if (done || !dateMap.has(key)) {
        dateMap.set(key, done || dateMap.get(key) || false);
      }
      if (done) dateMap.set(key, true);
    }

    const endKey = this.toDateKey(endDate);
    let longestStreak = 0;
    let streak = 0;
    for (
      let d = new Date(endDate);
      d >= new Date("2020-01-01");
      d.setDate(d.getDate() - 1)
    ) {
      const key = this.toDateKey(d);
      const done = dateMap.get(key) ?? false;
      if (done) {
        streak += 1;
        longestStreak = Math.max(longestStreak, streak);
      } else if (key === endKey) {
        // 今天未打卡不中断当前连续（允许当天还未到打卡时间）
        continue;
      } else {
        break;
      }
    }

    return { currentStreak: streak, longestStreak };
  }

  private computeGoalStreak(
    checkins: Array<{ date: Date; result: string }>,
  ): number {
    const dateMap = new Map<string, boolean>();
    for (const c of checkins) {
      const key = this.toDateKey(c.date);
      const done = c.result === "completed" || c.result === "partial";
      if (done) dateMap.set(key, true);
    }

    const today = new Date();
    let streak = 0;
    for (
      let d = new Date(today);
      d >= new Date("2020-01-01");
      d.setDate(d.getDate() - 1)
    ) {
      const key = this.toDateKey(d);
      if (dateMap.get(key)) {
        streak += 1;
      } else if (key === this.toDateKey(today)) {
        continue;
      } else {
        break;
      }
    }

    return streak;
  }

  private toDateKey(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  }
}
