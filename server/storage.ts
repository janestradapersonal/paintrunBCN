import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, activities, verificationCodes, type User, type Activity, type VerificationCode } from "@shared/schema";

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

  createActivity(userId: string, name: string, coordinates: number[][], polygon: number[][] | null, areaSqMeters: number, distanceMeters: number): Promise<Activity>;
  getActivitiesByUser(userId: string): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | undefined>;

  getRankings(): Promise<(User & { rank: number })[]>;
  getUserRank(userId: string): Promise<number>;
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

  async createActivity(userId: string, name: string, coordinates: number[][], polygon: number[][] | null, areaSqMeters: number, distanceMeters: number): Promise<Activity> {
    const [activity] = await db.insert(activities).values({
      userId,
      name,
      coordinates,
      polygon,
      areaSqMeters,
      distanceMeters,
    }).returning();
    return activity;
  }

  async getActivitiesByUser(userId: string): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.userId, userId)).orderBy(desc(activities.uploadedAt));
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

  async getUserRank(userId: string): Promise<number> {
    const rankings = await this.getRankings();
    const idx = rankings.findIndex((u) => u.id === userId);
    return idx >= 0 ? idx + 1 : 0;
  }
}

export const storage = new DatabaseStorage();
