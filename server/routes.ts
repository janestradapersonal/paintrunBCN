import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { registerSchema, loginSchema, verifySchema } from "@shared/schema";
import { parseGPX, calculateDistance, detectClosedLoop, calculateArea, detectNeighborhood, getMonthKey } from "./gpx";
import { seedDatabase } from "./seed";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import multer from "multer";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autorizado" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgSession = connectPgSimple(session);
  const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  app.use(
    session({
      store: new PgSession({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "paintrunbcn-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, username, password } = parsed.data;

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Este email ya está registrado" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Este nombre de usuario ya existe" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await storage.createUser(email, username, passwordHash);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await storage.createVerificationCode(email, code, expiresAt);

      console.log(`[paintrunBCN] Verification code for ${email}: ${code}`);

      return res.json({ 
        message: "Cuenta creada. Verifica tu email.", 
        verificationCode: process.env.NODE_ENV !== "production" ? code : undefined 
      });
    } catch (error: any) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Error al registrar" });
    }
  });

  app.post("/api/auth/verify", async (req: Request, res: Response) => {
    try {
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, code } = parsed.data;

      const vc = await storage.getVerificationCode(email, code);
      if (!vc) {
        return res.status(400).json({ message: "Código inválido o expirado" });
      }

      await storage.markCodeUsed(vc.id);
      await storage.verifyUser(email);

      const user = await storage.getUserByEmail(email);
      if (user) {
        req.session.userId = user.id;
      }

      return res.json({ message: "Email verificado" });
    } catch (error: any) {
      console.error("Verify error:", error);
      return res.status(500).json({ message: "Error al verificar" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Email o contraseña incorrectos" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Email o contraseña incorrectos" });
      }

      if (!user.verified) {
        return res.status(403).json({ message: "Debes verificar tu email primero" });
      }

      req.session.userId = user.id;
      return res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        totalAreaSqMeters: user.totalAreaSqMeters,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autorizado" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    return res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      totalAreaSqMeters: user.totalAreaSqMeters,
      verified: user.verified,
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.post("/api/activities/upload", requireAuth, upload.single("gpx"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ningún archivo" });
      }

      const gpxContent = req.file.buffer.toString("utf-8");
      const { name, coordinates } = parseGPX(gpxContent);

      if (coordinates.length < 2) {
        return res.status(400).json({ message: "El archivo GPX no contiene puntos de track válidos" });
      }

      const distance = calculateDistance(coordinates);
      const polygon = detectClosedLoop(coordinates);
      const area = polygon ? calculateArea(polygon) : 0;
      const neighborhoodName = detectNeighborhood(coordinates);
      const monthKey = getMonthKey();

      const activity = await storage.createActivity(
        req.session.userId!,
        name,
        coordinates,
        polygon,
        area,
        distance,
        neighborhoodName,
        monthKey
      );

      await storage.updateUserArea(req.session.userId!);

      return res.json(activity);
    } catch (error: any) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "Error al procesar el archivo GPX" });
    }
  });

  app.get("/api/activities", requireAuth, async (req: Request, res: Response) => {
    const monthKey = req.query.month as string | undefined;
    if (monthKey) {
      const activities = await storage.getActivitiesByUserAndMonth(req.session.userId!, monthKey);
      return res.json(activities);
    }
    const activities = await storage.getActivitiesByUser(req.session.userId!);
    return res.json(activities);
  });

  app.get("/api/users/me/stats", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    const rank = await storage.getUserRank(user.id);
    const titles = await storage.getUserTitles(user.id);
    return res.json({
      totalAreaSqMeters: user.totalAreaSqMeters,
      rank,
      titles,
    });
  });

  app.get("/api/rankings", async (req: Request, res: Response) => {
    const monthKey = req.query.month as string | undefined;
    
    if (monthKey) {
      const rankings = await storage.getMonthlyGlobalRankings(monthKey);
      return res.json(rankings);
    }

    const rankings = await storage.getRankings();
    return res.json(
      rankings.map((u) => ({
        id: u.id,
        username: u.username,
        totalAreaSqMeters: u.totalAreaSqMeters,
        rank: u.rank,
      }))
    );
  });

  app.get("/api/rankings/neighborhoods", async (req: Request, res: Response) => {
    const monthKey = (req.query.month as string) || getMonthKey();
    const rankings = await storage.getMonthlyNeighborhoodRankings(monthKey);
    return res.json(rankings);
  });

  app.get("/api/rankings/neighborhoods/:name", async (req: Request, res: Response) => {
    const monthKey = (req.query.month as string) || getMonthKey();
    const name = req.params.name as string;
    const leaderboard = await storage.getNeighborhoodLeaderboard(name, monthKey);
    return res.json(leaderboard);
  });

  app.get("/api/users/:userId/activities", async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const monthKey = req.query.month as string | undefined;
    if (monthKey) {
      const acts = await storage.getActivitiesByUserAndMonth(userId, monthKey);
      return res.json(acts);
    }
    const acts = await storage.getActivitiesByUser(userId);
    return res.json(acts);
  });

  app.get("/api/users/:userId/titles", async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const titles = await storage.getUserTitles(userId);
    return res.json(titles);
  });

  await seedDatabase();

  return httpServer;
}
