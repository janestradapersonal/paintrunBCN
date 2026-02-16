import { eq, desc, sql, and, or, ilike, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, activities, verificationCodes, monthlyTitles, follows, stravaTokens, livePoints, type User, type Activity, type VerificationCode, type MonthlyTitle, type Follow, type StravaToken } from "@shared/schema";
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
  createActivity(userId: string, name: string, coordinates: number[][], polygon: number[][] | null, areaSqMeters: number, distanceMeters: number, neighborhoodName: string | null, monthKey: string, uploadedAt?: Date, stravaActivityId?: number): Promise<Activity>;
  getActivityByStravaId(userId: string, stravaActivityId: number): Promise<Activity | undefined>;
  getActivitiesByUser(userId: string): Promise<Activity[]>;
  getActivitiesByUserAndMonth(userId: string, monthKey: string): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | undefined>;

  getRankings(): Promise<(User & { rank: number })[]>;
  getMonthlyGlobalRankings(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]>;
  getMonthlyNeighborhoodRankings(monthKey: string, groupId?: string): Promise<{ neighborhoodName: string; topUser: string; topUserId: string; totalAreaSqMeters: number; runnerCount: number }[]>;
  getNeighborhoodLeaderboard(neighborhoodName: string, monthKey: string, groupId?: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]>;
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
  getFollowerRankings(): Promise<{ id: string; username: string; followerCount: number }[]>;

  getGlobalLiveRankings(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; paintColor: string; territorySqMeters: number; territoryPercent: number; rank: number }[]>;
  getGlobalLiveTerritories(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; paintColor: string; polygons: number[][][] }[]>;
  incrementPointsForMonth(monthKey: string, increments: { userId: string; points: number }[]): Promise<void>;
  getLivePointsRanking(monthKey: string): Promise<{ userId: string; username: string; paintColor: string; points: number; rank: number }[]>;

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

  async createActivity(userId: string, name: string, coordinates: number[][], polygon: number[][] | null, areaSqMeters: number, distanceMeters: number, neighborhoodName: string | null, monthKey: string, uploadedAt?: Date, stravaActivityId?: number): Promise<Activity> {
    const insertObj: any = {
      userId,
      name,
      coordinates,
      polygon,
      areaSqMeters,
      distanceMeters,
      neighborhoodName,
      monthKey,
    };
    if (uploadedAt) insertObj.uploadedAt = uploadedAt;
    if (stravaActivityId !== undefined) insertObj.stravaActivityId = stravaActivityId;
    const [activity] = await db.insert(activities).values(insertObj).returning();
    return activity;
  }

  async getActivityByStravaId(userId: string, stravaActivityId: number): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(and(eq(activities.userId, userId), eq(activities.stravaActivityId, stravaActivityId)));
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
      .orderBy(desc(users.totalAreaSqMeters));
    return allUsers.map((u, i) => ({ ...u, rank: i + 1 }));
  }

  async getMonthlyGlobalRankings(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]> {
    // If groupId is provided, only include users who are members of that group.
    if (groupId) {
      const q = await db.execute(sql`
        SELECT u.id as userId, u.username, COALESCE(SUM(a.area_sq_meters), 0) as totalArea
        FROM users u
        JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ${groupId}
        LEFT JOIN activities a ON a.user_id = u.id AND a.month_key = ${monthKey}
        GROUP BY u.id, u.username
        ORDER BY COALESCE(SUM(a.area_sq_meters), 0) DESC, u.username ASC
      `);
      const rows = q.rows || [];
      return rows.map((r: any, i: number) => ({ userId: r.userid || r.userId, username: r.username, totalAreaSqMeters: Number(r.totalarea || r.totalArea), rank: i + 1 }));
    }

    // Include all users (even those without activities in the month) using LEFT JOIN.
    const results = await db
      .select({
        userId: users.id,
        username: users.username,
        totalAreaSqMeters: sql<number>`COALESCE(SUM(${activities.areaSqMeters}), 0)`,
      })
      .from(users)
      .leftJoin(activities, and(eq(activities.userId, users.id), eq(activities.monthKey, monthKey)))
      .groupBy(users.id, users.username)
      .orderBy(desc(sql`COALESCE(SUM(${activities.areaSqMeters}), 0)`), asc(users.username));

    return results.map((r, i) => ({
      userId: r.userId,
      username: r.username,
      totalAreaSqMeters: Number(r.totalAreaSqMeters),
      rank: i + 1,
    }));
  }

  async getMonthlyNeighborhoodRankings(monthKey: string, groupId?: string): Promise<{ neighborhoodName: string; topUser: string; topUserId: string; totalAreaSqMeters: number; runnerCount: number }[]> {
    // If groupId is present, only consider activities from users in that group
    const groupFilter = groupId ? sql`AND a.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId})` : sql``;

    const results = await db.execute(sql`
      SELECT a.neighborhood_name as neighborhoodName, COALESCE(SUM(a.area_sq_meters),0) as totalAreaSqMeters, COUNT(DISTINCT a.user_id) as runnerCount
      FROM activities a
      WHERE a.month_key = ${monthKey} AND a.neighborhood_name IS NOT NULL
      ${groupId ? sql`AND a.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId})` : sql``}
      GROUP BY a.neighborhood_name
      ORDER BY SUM(a.area_sq_meters) DESC
    `);

    const rows = results.rows || [];
    const enriched: any[] = [];
    for (const r of rows) {
      const neighborhood = r.neighborhoodname || r.neighborhoodName;
      // find top runner in this neighborhood, respecting group filter
      const topQ = await db.execute(sql`
        SELECT a.user_id as userId, u.username as username, COALESCE(SUM(a.area_sq_meters),0) as total
        FROM activities a
        JOIN users u ON u.id = a.user_id
        WHERE a.month_key = ${monthKey} AND a.neighborhood_name = ${neighborhood}
        ${groupId ? sql`AND a.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId})` : sql``}
        GROUP BY a.user_id, u.username
        ORDER BY SUM(a.area_sq_meters) DESC
        LIMIT 1
      `);

      enriched.push({
        neighborhoodName: neighborhood,
        topUser: (topQ.rows && topQ.rows[0] && (topQ.rows[0].username || topQ.rows[0].userName)) || "—",
        topUserId: (topQ.rows && topQ.rows[0] && (topQ.rows[0].userid || topQ.rows[0].userId)) || "",
        totalAreaSqMeters: Number(r.totalareasqmeters || r.totalareasks || r.totalarea || r.totalAreaSqMeters || r.totalareasqmeters || 0),
        runnerCount: Number(r.runnercount || r.runnerCount || 0),
      });
    }
    return enriched;
  }

  async getNeighborhoodLeaderboard(neighborhoodName: string, monthKey: string, groupId?: string): Promise<{ userId: string; username: string; totalAreaSqMeters: number; rank: number }[]> {
    // If groupId provided, only include activities from users in that group
    if (groupId) {
      const q = await db.execute(sql`
        SELECT a.user_id as userId, u.username as username, COALESCE(SUM(a.area_sq_meters),0) as total
        FROM activities a
        JOIN users u ON u.id = a.user_id
        WHERE a.month_key = ${monthKey} AND a.neighborhood_name = ${neighborhoodName} AND a.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId})
        GROUP BY a.user_id, u.username
        ORDER BY SUM(a.area_sq_meters) DESC
      `);
      const rows = q.rows || [];
      return rows.map((r: any, i: number) => ({ userId: r.userid || r.userId, username: r.username, totalAreaSqMeters: Number(r.total || r.totalarea || 0), rank: i + 1 }));
    }

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
      .select({ count: sql<number>`COUNT(${activities.id})` })
      .from(activities)
      .where(eq(activities.userId, userId));

    const [followerResult] = await db
      .select({ count: sql<number>`COUNT(${follows.id})` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const [followingResult] = await db
      .select({ count: sql<number>`COUNT(${follows.id})` })
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
    // Return total number of registered users.
    const [result] = await db
      .select({ count: sql<number>`COUNT(${users.id})` })
      .from(users);
    return Number(result?.count || 0);
  }

  async getFollowerRankings(): Promise<{ id: string; username: string; followerCount: number }[]> {
    const results = await db
      .select({ id: users.id, username: users.username, followerCount: sql<number>`COALESCE(COUNT(${follows.id}), 0)` })
      .from(users)
      .leftJoin(follows, eq(follows.followingId, users.id))
      .groupBy(users.id, users.username)
      .orderBy(desc(sql`COALESCE(COUNT(${follows.id}), 0)`), asc(users.username));

    return results.map(r => ({ id: r.id, username: r.username, followerCount: Number(r.followerCount) }));
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

  async getGlobalLiveRankings(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; paintColor: string; territorySqMeters: number; territoryPercent: number; rank: number }[]> {
    const BARCELONA_AREA_SQM = 101_400_000;

    // If a groupId is provided, only consider activities from users in that group
    const monthActivities = groupId
      ? (await db.execute(sql`SELECT * FROM activities a WHERE a.month_key = ${monthKey} AND a.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId}) ORDER BY a.uploaded_at ASC`)).rows
      : await db.select().from(activities).where(eq(activities.monthKey, monthKey)).orderBy(asc(activities.uploadedAt));

    // Fetch all verified users so we can include those with 0 territory.
    // Determine which users to include: either all verified users or only group members
    let usersList: any[] = [];
    if (groupId) {
      const q = await db.execute(sql`SELECT u.id, u.username, u.paint_color as paintColor FROM users u JOIN group_members gm ON gm.user_id = u.id WHERE gm.group_id = ${groupId} ORDER BY u.username ASC`);
      usersList = q.rows || [];
    } else {
      usersList = await db.select({ id: users.id, username: users.username, paintColor: users.paintColor }).from(users).orderBy(asc(users.username));
    }

    const userMap = new Map<string, { username: string; paintColor: string }>();
    for (const u of usersList) {
      userMap.set(u.id, { username: u.username, paintColor: u.paintColor });
    }

    const territories = this.computeTerritories(monthActivities, userMap);

    const rankings: { userId: string; username: string; paintColor: string; territorySqMeters: number; territoryPercent: number; rank: number }[] = [];
    for (const u of usersList) {
      const userId = u.id;
      const userInfo = userMap.get(userId)!;
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

    rankings.sort((a, b) => {
      if (b.territorySqMeters !== a.territorySqMeters) return b.territorySqMeters - a.territorySqMeters;
      return a.username.localeCompare(b.username);
    });
    rankings.forEach((r, i) => { r.rank = i + 1; });

    return rankings;
  }

  async getGlobalLiveTerritories(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; paintColor: string; polygons: number[][][] }[]> {
    const monthActivities = groupId
      ? (await db.execute(sql`SELECT * FROM activities a WHERE a.month_key = ${monthKey} AND a.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId}) ORDER BY a.uploaded_at ASC`)).rows
      : await db.select().from(activities).where(eq(activities.monthKey, monthKey)).orderBy(asc(activities.uploadedAt));

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

  async incrementPointsForMonth(monthKey: string, increments: { userId: string; points: number }[]): Promise<void> {
    // For each increment, upsert into livePoints: add points to existing row or create it.
    const now = new Date();
    await db.transaction(async (trx) => {
      for (const inc of increments) {
        const [existing] = await trx.select().from(livePoints).where(and(eq(livePoints.userId, inc.userId), eq(livePoints.monthKey, monthKey)));
        if (existing) {
          await trx.update(livePoints).set({ points: Number(existing.points || 0) + inc.points, updatedAt: now }).where(eq(livePoints.id, existing.id));
        } else {
          await trx.insert(livePoints).values({ userId: inc.userId, monthKey, points: inc.points }).returning();
        }
      }
    });
  }

  async getLivePointsRanking(monthKey: string, groupId?: string): Promise<{ userId: string; username: string; paintColor: string; points: number; rank: number }[]> {
    // Include all users with 0 points when absent. If groupId provided, restrict to group members.
    if (groupId) {
      const q = await db.execute(sql`
        SELECT u.id as userId, u.username as username, u.paint_color as paintColor, COALESCE(lp.points,0) as points
        FROM users u
        JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ${groupId}
        LEFT JOIN live_points lp ON lp.user_id = u.id AND lp.month_key = ${monthKey}
        ORDER BY COALESCE(lp.points,0) DESC, u.username ASC
      `);
      const rows = q.rows || [];
      return rows.map((r: any, i: number) => ({ userId: r.userid || r.userId, username: r.username, paintColor: r.paintcolor || r.paintColor, points: Number(r.points || 0), rank: i + 1 }));
    }

    const results = await db
      .select({ userId: users.id, username: users.username, paintColor: users.paintColor, points: sql<number>`COALESCE(${livePoints.points}, 0)` })
      .from(users)
      .leftJoin(livePoints, and(eq(livePoints.userId, users.id), eq(livePoints.monthKey, monthKey)))
      .groupBy(users.id, users.username, users.paintColor, livePoints.points)
      .orderBy(desc(sql`COALESCE(${livePoints.points}, 0)`), asc(users.username));

    return results.map((r, i) => ({ userId: r.userId, username: r.username, paintColor: r.paintColor, points: Number(r.points || 0), rank: i + 1 }));
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

  // --- Groups / Stripe events helpers ---
  async updateUserStripeCustomer(userId: string, customerId: string): Promise<void> {
    await db.execute(sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}`);
  }

  async createGroup(ownerUserId: string, name: string | null, inviteCode: string, stripeSubscriptionId: string | null): Promise<string> {
    const insertQuery = await db.execute(sql`INSERT INTO groups (name, owner_user_id, invite_code, stripe_subscription_id, status, created_at) VALUES (${name}, ${ownerUserId}, ${inviteCode}, ${stripeSubscriptionId}, 'active', NOW()) RETURNING id`);
    const id = insertQuery && (insertQuery.rows && insertQuery.rows[0] && insertQuery.rows[0].id);
    if (!id) throw new Error("Failed to create group");
    return String(id);
  }

  async addGroupMember(groupId: string, userId: string, role: string = "member"): Promise<void> {
    await db.execute(sql`INSERT INTO group_members (group_id, user_id, role, created_at) VALUES (${groupId}, ${userId}, ${role}, NOW()) ON CONFLICT DO NOTHING`);
  }

  async getGroupsForUser(userId: string): Promise<any[]> {
    const q = await db.execute(sql`SELECT g.id, g.name, g.invite_code, gm.role, g.status, g.created_at FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ${userId} ORDER BY g.created_at DESC`);
    return q.rows || [];
  }

  async findGroupByInviteCode(inviteCode: string): Promise<any | undefined> {
    const q = await db.execute(sql`SELECT * FROM groups WHERE invite_code = ${inviteCode} AND status = 'active' LIMIT 1`);
    return (q.rows && q.rows[0]) || undefined;
  }

  async updateGroupName(groupId: string, name: string): Promise<void> {
    await db.execute(sql`UPDATE groups SET name = ${name} WHERE id = ${groupId}`);
  }

  async findStripeEventById(eventId: string): Promise<boolean> {
    const q = await db.execute(sql`SELECT 1 FROM stripe_events WHERE event_id = ${eventId} LIMIT 1`);
    return !!(q && (q.rowCount || 0) > 0);
  }

  async insertStripeEvent(eventId: string, payload: string): Promise<void> {
    await db.execute(sql`INSERT INTO stripe_events (event_id, payload, created_at) VALUES (${eventId}, ${payload}, NOW()) ON CONFLICT DO NOTHING`);
  }

  async markGroupsInactiveBySubscriptionId(subscriptionId: string): Promise<void> {
    await db.execute(sql`UPDATE groups SET status = 'inactive' WHERE stripe_subscription_id = ${subscriptionId}`);
  }
}

export const storage = new DatabaseStorage();
