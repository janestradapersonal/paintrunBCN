import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  verified: boolean("verified").notNull().default(false),
  totalAreaSqMeters: real("total_area_sq_meters").notNull().default(0),
  paintColor: text("paint_color").notNull().default("#FF6B35"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  coordinates: jsonb("coordinates").notNull().$type<number[][]>(),
  polygon: jsonb("polygon").$type<number[][]>(),
  areaSqMeters: real("area_sq_meters").notNull().default(0),
  distanceMeters: real("distance_meters").notNull().default(0),
  neighborhoodName: text("neighborhood_name"),
  monthKey: text("month_key"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const monthlyTitles = pgTable("monthly_titles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  monthKey: text("month_key").notNull(),
  titleType: text("title_type").notNull(),
  neighborhoodName: text("neighborhood_name"),
  rank: integer("rank").notNull().default(1),
  areaSqMeters: real("area_sq_meters").notNull().default(0),
});

export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followingId: varchar("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.followerId, table.followingId),
]);

export const stravaTokens = pgTable("strava_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  stravaAthleteId: integer("strava_athlete_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  passwordHash: true,
});

export const registerSchema = z.object({
  email: z.string().email("Email no válido"),
  username: z.string().min(3, "Mínimo 3 caracteres").max(30, "Máximo 30 caracteres"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "El código debe tener 6 dígitos"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type MonthlyTitle = typeof monthlyTitles.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type StravaToken = typeof stravaTokens.$inferSelect;
