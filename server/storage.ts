import { eq, desc, sql, and, or, ilike, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, activities, verificationCodes, monthlyTitles, follows, stravaTokens, type User, type Activity, type VerificationCode, type MonthlyTitle, type Follow, type StravaToken } from "@shared/schema";
import * as turf from "@turf/turf";

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
  updatePaintColor(userId: string, color: string): Promise<void>;

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

  searchUsers(query: string): Promise<{ id: string; username: string; totalAreaSqMeters: number }[]>;
  getUserProfile(userId: string): Promise<{ id: string; username: string; totalAreaSqMeters: number; createdAt: Date; activityCount: number; followerCount: number; followingCount: number } | undefined>;

  followUser(followerId: string, followingId: string): Promise<void>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowers(userId: string): Promise<{ id: string; username: string; totalAreaSqMeters: number }[]>;
  getFollowing(userId: string): Promise<{ id: string; username: string; totalAreaSqMeters: number }[]>;

  getMonthlyGlobalParticipantCount(monthKey: string): Promise<number>;
  getMonthlyNeighborhoodParticipantCount(neighborhoodName: string, monthKey: string): Promise<number>;

  getGlobalLiveRankings(monthKey: string): Promise<{ userId: string; username: string; paintColor: string; territorySqMeters: number; territoryPercent: number; rank: number }[]>;
  getGlobalLiveTerritories(monthKey: string): Promise<{ userId: string; username: string; paintColor: string; polygons: number[][][] }[]>;

  getStravaToken(userId: string): Promise<StravaToken | undefined>;
  getStravaTokenByAthleteId(athleteId: number): Promise<StravaToken | undefined>;
  upsertStravaToken(userId: string, athleteId: number, accessToken: string, refreshToken: string, expiresAt: number): Promise<StravaToken>;
  deleteStravaToken(userId: string): Promise<void>;
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

  async updatePaintColor(userId: string, color: string): Promise<void> {
    await db.update(users).set({ paintColor: color }).where(eq(users.id, userId));
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

  async searchUsers(query: string): Promise<{ id: string; username: string; totalAreaSqMeters: number }[]> {
    const results = await db.select({
      id: users.id,
      username: users.username,
      totalAreaSqMeters: users.totalAreaSqMeters,
    }).from(users)
      .where(and(eq(users.verified, true), ilike(users.username, `%${query}%`)))
      .orderBy(desc(users.totalAreaSqMeters))
      .limit(20);
    return results;
  }

  async getUserProfile(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;

    const [activityResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(activities)
      .where(eq(activities.userId, userId));

    const [followerResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const [followingResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId));

    return {
      id: user.id,
      username: user.username,
      totalAreaSqMeters: user.totalAreaSqMeters,
      paintColor: user.paintColor,
      createdAt: user.createdAt,
      activityCount: Number(activityResult?.count || 0),
      followerCount: Number(followerResult?.count || 0),
      followingCount: Number(followingResult?.count || 0),
    };
  }

  async followUser(followerId: string, followingId: string): Promise<void> {
    await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [result] = await db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    return !!result;
  }

  async getFollowers(userId: string): Promise<{ id: string; username: string; totalAreaSqMeters: number }[]> {
    const results = await db
      .select({ id: users.id, username: users.username, totalAreaSqMeters: users.totalAreaSqMeters })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(users.totalAreaSqMeters));
    return results;
  }

  async getFollowing(userId: string): Promise<{ id: string; username: string; totalAreaSqMeters: number }[]> {
    const results = await db
      .select({ id: users.id, username: users.username, totalAreaSqMeters: users.totalAreaSqMeters })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(users.totalAreaSqMeters));
    return results;
  }

  async getMonthlyGlobalParticipantCount(monthKey: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${activities.userId})` })
      .from(activities)
      .where(eq(activities.monthKey, monthKey));
    return Number(result?.count || 0);
  }

  async getMonthlyNeighborhoodParticipantCount(neighborhoodName: string, monthKey: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${activities.userId})` })
      .from(activities)
      .where(and(eq(activities.monthKey, monthKey), eq(activities.neighborhoodName, neighborhoodName)));
    return Number(result?.count || 0);
  }

  private computeTerritories(monthActivities: Activity[], userMap: Map<string, { username: string; paintColor: string }>): Map<string, { polygons: any[]; totalArea: number }> {
    const BARCELONA_AREA_SQM = 101_400_000;
    const result = new Map<string, { polygons: any[]; totalArea: number }>();

    const withPolygons = monthActivities
      .filter(a => a.polygon && (a.polygon as number[][]).length >= 4)
      .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

    if (withPolygons.length === 0) return result;

    const activityPolygons: { userId: string; turfPoly: any; uploadedAt: Date }[] = [];
    for (const act of withPolygons) {
      try {
        const coords = act.polygon as number[][];
        const closed = coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]
          ? coords
          : [...coords, coords[0]];
        if (closed.length < 4) continue;
        const poly = turf.polygon([closed]);
        activityPolygons.push({ userId: act.userId, turfPoly: poly, uploadedAt: new Date(act.uploadedAt) });
      } catch {
        continue;
      }
    }

    for (let i = 0; i < activityPolygons.length; i++) {
      const act = activityPolygons[i];
      let remaining: any = act.turfPoly;

      for (let j = i + 1; j < activityPolygons.length; j++) {
        const later = activityPolygons[j];
        if (later.userId === act.userId) continue;
        try {
          const diff = turf.difference(
            turf.featureCollection([remaining, later.turfPoly])
          );
          if (!diff) {
            remaining = null;
            break;
          }
          remaining = diff;
        } catch {
          continue;
        }
      }

      if (!remaining) continue;

      const userId = act.userId;
      if (!result.has(userId)) {
        result.set(userId, { polygons: [], totalArea: 0 });
      }
      const entry = result.get(userId)!;

      try {
        const area = turf.area(remaining);
        entry.totalArea += area;

        if (remaining.geometry.type === "Polygon") {
          entry.polygons.push(remaining.geometry.coordinates);
        } else if (remaining.geometry.type === "MultiPolygon") {
          for (const poly of remaining.geometry.coordinates) {
            entry.polygons.push(poly);
          }
        }
      } catch {
        continue;
      }
    }

    return result;
  }

  async getGlobalLiveRankings(monthKey: string): Promise<{ userId: string; username: string; paintColor: string; territorySqMeters: number; territoryPercent: number; rank: number }[]> {
    const BARCELONA_AREA_SQM = 101_400_000;

    const monthActivities = await db.select().from(activities)
      .where(eq(activities.monthKey, monthKey))
      .orderBy(asc(activities.uploadedAt));

    const userIdSet = new Set(monthActivities.map(a => a.userId));
    const userIds = Array.from(userIdSet);
    if (userIds.length === 0) return [];

    const userMap = new Map<string, { username: string; paintColor: string }>();
    for (const uid of userIds) {
      const [u] = await db.select({ username: users.username, paintColor: users.paintColor }).from(users).where(eq(users.id, uid));
      if (u) userMap.set(uid, u);
    }

    const territories = this.computeTerritories(monthActivities, userMap);

    const rankings: { userId: string; username: string; paintColor: string; territorySqMeters: number; territoryPercent: number; rank: number }[] = [];
    for (const [userId, userInfo] of Array.from(userMap.entries())) {
      const data = territories.get(userId);
      const totalArea = data?.totalArea || 0;
      rankings.push({
        userId,
        username: userInfo.username,
        paintColor: userInfo.paintColor,
        territorySqMeters: Math.round(totalArea),
        territoryPercent: parseFloat(((totalArea / BARCELONA_AREA_SQM) * 100).toFixed(4)),
        rank: 0,
      });
    }

    rankings.sort((a, b) => b.territorySqMeters - a.territorySqMeters);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    return rankings;
  }

  async getGlobalLiveTerritories(monthKey: string): Promise<{ userId: string; username: string; paintColor: string; polygons: number[][][] }[]> {
    const monthActivities = await db.select().from(activities)
      .where(eq(activities.monthKey, monthKey))
      .orderBy(asc(activities.uploadedAt));

    const userIdSet = new Set(monthActivities.map(a => a.userId));
    const userIds = Array.from(userIdSet);
    if (userIds.length === 0) return [];

    const userMap = new Map<string, { username: string; paintColor: string }>();
    for (const uid of userIds) {
      const [u] = await db.select({ username: users.username, paintColor: users.paintColor }).from(users).where(eq(users.id, uid));
      if (u) userMap.set(uid, u);
    }

    const territories = this.computeTerritories(monthActivities, userMap);

    const result: { userId: string; username: string; paintColor: string; polygons: number[][][] }[] = [];
    const terrEntries = Array.from(territories.entries());
    for (const [userId, data] of terrEntries) {
      const userInfo = userMap.get(userId);
      if (!userInfo || data.polygons.length === 0) continue;
      result.push({
        userId,
        username: userInfo.username,
        paintColor: userInfo.paintColor,
        polygons: data.polygons,
      });
    }

    return result;
  }

  async getStravaToken(userId: string): Promise<StravaToken | undefined> {
    const [token] = await db.select().from(stravaTokens).where(eq(stravaTokens.userId, userId));
    return token;
  }

  async getStravaTokenByAthleteId(athleteId: number): Promise<StravaToken | undefined> {
    const [token] = await db.select().from(stravaTokens).where(eq(stravaTokens.stravaAthleteId, athleteId));
    return token;
  }

  async upsertStravaToken(userId: string, athleteId: number, accessToken: string, refreshToken: string, expiresAt: number): Promise<StravaToken> {
    const existing = await this.getStravaToken(userId);
    if (existing) {
      const [updated] = await db.update(stravaTokens)
        .set({ stravaAthleteId: athleteId, accessToken, refreshToken, expiresAt })
        .where(eq(stravaTokens.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(stravaTokens)
      .values({ userId, stravaAthleteId: athleteId, accessToken, refreshToken, expiresAt })
      .returning();
    return created;
  }

  async deleteStravaToken(userId: string): Promise<void> {
    await db.delete(stravaTokens).where(eq(stravaTokens.userId, userId));
  }
}

export const storage = new DatabaseStorage();
