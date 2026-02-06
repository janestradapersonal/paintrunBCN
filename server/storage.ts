import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, activities, verificationCodes, monthlyTitles, type User, type Activity, type VerificationCode, type MonthlyTitle } from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(email: string, username: string, passwordHash: string): Promise<User>;
  verifyUser(email: string): Promise<void>;
  updateUserArea(userId: string): Promise<void>;

  createVerificationCode(email: string, code: string, expiresAt: Date): Promise<VerificationCode>;
  getVerificationCode(email: string, code: string): Promise<VerificationCode | undefined>;
  markCodeUsed(id: string): Promise<void>;

  createActivity(userId: string, name: string, coordinates: number[][], polygon: number[][] | null, areaSqMeters: number, distanceMeters: number, neighborhoodName: string | null, monthKey: string): Promise<Activity>;
  getActivitiesByUser(userId: string): Promise<Activity[]>;
  getActivitiesByUserAndMonth(userId: string, monthKey: string): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | undefined>;

  getRankings(): Promise<(User & { rank: number })[]>;
  getMonthlyGlobalRankings(monthKey: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]>;
  getMonthlyNeighborhoodRankings(monthKey: string): Promise<{ neighborhoodName: string; topUser: string; topUserId: string; totalAreaSqMeters: number; runnerCount: number }[]>;
  getNeighborhoodLeaderboard(neighborhoodName: string, monthKey: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]>;
  getUserRank(userId: string): Promise<number>;

  createMonthlyTitle(userId: string, monthKey: string, titleType: string, neighborhoodName: string | null, rank: number, areaSqMeters: number): Promise<MonthlyTitle>;
  getUserTitles(userId: string): Promise<MonthlyTitle[]>;
  getTitlesForMonth(monthKey: string): Promise<MonthlyTitle[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(email: string, username: string, passwordHash: string): Promise<User> {
    const [user] = await db.insert(users).values({ email, username, passwordHash }).returning();
    return user;
  }

  async verifyUser(email: string): Promise<void> {
    await db.update(users).set({ verified: true }).where(eq(users.email, email));
  }

  async updateUserArea(userId: string): Promise<void> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${activities.areaSqMeters}), 0)` })
      .from(activities)
      .where(eq(activities.userId, userId));
    const total = result[0]?.total || 0;
    await db.update(users).set({ totalAreaSqMeters: total }).where(eq(users.id, userId));
  }

  async createVerificationCode(email: string, code: string, expiresAt: Date): Promise<VerificationCode> {
    const [vc] = await db.insert(verificationCodes).values({ email, code, expiresAt }).returning();
    return vc;
  }

  async getVerificationCode(email: string, code: string): Promise<VerificationCode | undefined> {
    const [vc] = await db
      .select()
      .from(verificationCodes)
      .where(sql`${verificationCodes.email} = ${email} AND ${verificationCodes.code} = ${code} AND ${verificationCodes.used} = false AND ${verificationCodes.expiresAt} > NOW()`);
    return vc;
  }

  async markCodeUsed(id: string): Promise<void> {
    await db.update(verificationCodes).set({ used: true }).where(eq(verificationCodes.id, id));
  }

  async createActivity(userId: string, name: string, coordinates: number[][], polygon: number[][] | null, areaSqMeters: number, distanceMeters: number, neighborhoodName: string | null, monthKey: string): Promise<Activity> {
    const [activity] = await db.insert(activities).values({
      userId,
      name,
      coordinates,
      polygon,
      areaSqMeters,
      distanceMeters,
      neighborhoodName,
      monthKey,
    }).returning();
    return activity;
  }

  async getActivitiesByUser(userId: string): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.userId, userId)).orderBy(desc(activities.uploadedAt));
  }

  async getActivitiesByUserAndMonth(userId: string, monthKey: string): Promise<Activity[]> {
    return db.select().from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.monthKey, monthKey)))
      .orderBy(desc(activities.uploadedAt));
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity;
  }

  async getRankings(): Promise<(User & { rank: number })[]> {
    const allUsers = await db
      .select()
      .from(users)
      .where(eq(users.verified, true))
      .orderBy(desc(users.totalAreaSqMeters));
    return allUsers.map((u, i) => ({ ...u, rank: i + 1 }));
  }

  async getMonthlyGlobalRankings(monthKey: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]> {
    const results = await db
      .select({
        userId: activities.userId,
        username: users.username,
        totalAreaSqMeters: sql<number>`COALESCE(SUM(${activities.areaSqMeters}), 0)`,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.monthKey, monthKey))
      .groupBy(activities.userId, users.username)
      .orderBy(desc(sql`SUM(${activities.areaSqMeters})`));

    return results.map((r, i) => ({
      userId: r.userId,
      username: r.username,
      totalAreaSqMeters: Number(r.totalAreaSqMeters),
      rank: i + 1,
    }));
  }

  async getMonthlyNeighborhoodRankings(monthKey: string): Promise<{ neighborhoodName: string; topUser: string; topUserId: string; totalAreaSqMeters: number; runnerCount: number }[]> {
    const results = await db
      .select({
        neighborhoodName: activities.neighborhoodName,
        totalAreaSqMeters: sql<number>`COALESCE(SUM(${activities.areaSqMeters}), 0)`,
        runnerCount: sql<number>`COUNT(DISTINCT ${activities.userId})`,
      })
      .from(activities)
      .where(and(
        eq(activities.monthKey, monthKey),
        sql`${activities.neighborhoodName} IS NOT NULL`
      ))
      .groupBy(activities.neighborhoodName)
      .orderBy(desc(sql`SUM(${activities.areaSqMeters})`));

    const enriched = [];
    for (const r of results) {
      const topRunnerResult = await db
        .select({
          userId: activities.userId,
          username: users.username,
          total: sql<number>`COALESCE(SUM(${activities.areaSqMeters}), 0)`,
        })
        .from(activities)
        .innerJoin(users, eq(activities.userId, users.id))
        .where(and(
          eq(activities.monthKey, monthKey),
          eq(activities.neighborhoodName, r.neighborhoodName!)
        ))
        .groupBy(activities.userId, users.username)
        .orderBy(desc(sql`SUM(${activities.areaSqMeters})`))
        .limit(1);

      enriched.push({
        neighborhoodName: r.neighborhoodName!,
        topUser: topRunnerResult[0]?.username || "—",
        topUserId: topRunnerResult[0]?.userId || "",
        totalAreaSqMeters: Number(r.totalAreaSqMeters),
        runnerCount: Number(r.runnerCount),
      });
    }
    return enriched;
  }

  async getNeighborhoodLeaderboard(neighborhoodName: string, monthKey: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]> {
    const results = await db
      .select({
        userId: activities.userId,
        username: users.username,
        totalAreaSqMeters: sql<number>`COALESCE(SUM(${activities.areaSqMeters}), 0)`,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .where(and(
        eq(activities.monthKey, monthKey),
        eq(activities.neighborhoodName, neighborhoodName)
      ))
      .groupBy(activities.userId, users.username)
      .orderBy(desc(sql`SUM(${activities.areaSqMeters})`));

    return results.map((r, i) => ({
      userId: r.userId,
      username: r.username,
      totalAreaSqMeters: Number(r.totalAreaSqMeters),
      rank: i + 1,
    }));
  }

  async getUserRank(userId: string): Promise<number> {
    const rankings = await this.getRankings();
    const idx = rankings.findIndex((u) => u.id === userId);
    return idx >= 0 ? idx + 1 : 0;
  }

  async createMonthlyTitle(userId: string, monthKey: string, titleType: string, neighborhoodName: string | null, rank: number, areaSqMeters: number): Promise<MonthlyTitle> {
    const [title] = await db.insert(monthlyTitles).values({
      userId,
      monthKey,
      titleType,
      neighborhoodName,
      rank,
      areaSqMeters,
    }).returning();
    return title;
  }

  async getUserTitles(userId: string): Promise<MonthlyTitle[]> {
    return db.select().from(monthlyTitles)
      .where(eq(monthlyTitles.userId, userId))
      .orderBy(desc(monthlyTitles.monthKey));
  }

  async getTitlesForMonth(monthKey: string): Promise<MonthlyTitle[]> {
    return db.select().from(monthlyTitles)
      .where(eq(monthlyTitles.monthKey, monthKey));
  }
}

export const storage = new DatabaseStorage();
