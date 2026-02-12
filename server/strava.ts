import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import * as polylineCodec from "@googlemaps/polyline-codec";
import { detectClosedLoop, calculateArea, calculateDistance, detectNeighborhood, getMonthKey } from "./gpx";

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || "";
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || "";
const STRAVA_VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN || "paintrunbcn_strava_verify";

function getBaseUrl(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
  return `${proto}://${host}`;
}

async function refreshStravaToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_at: number } | null> {
  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const token = await storage.getStravaToken(userId);
  if (!token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (token.expiresAt > now + 60) {
    return token.accessToken;
  }

  const refreshed = await refreshStravaToken(token.refreshToken);
  if (!refreshed) return null;

  await storage.upsertStravaToken(
    userId,
    token.stravaAthleteId,
    refreshed.access_token,
    refreshed.refresh_token,
    refreshed.expires_at
  );
  return refreshed.access_token;
}

async function processStravaActivity(athleteId: number, activityId: number): Promise<void> {
  const tokenRecord = await storage.getStravaTokenByAthleteId(athleteId);
  if (!tokenRecord) {
    console.log(`[Strava] No token found for athlete ${athleteId}`);
    return;
  }

  const accessToken = await getValidAccessToken(tokenRecord.userId);
  if (!accessToken) {
    console.log(`[Strava] Could not get valid access token for user ${tokenRecord.userId}`);
    return;
  }

  try {
    const activityRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!activityRes.ok) {
      console.log(`[Strava] Failed to fetch activity ${activityId}: ${activityRes.status}`);
      return;
    }
    const activity = await activityRes.json() as any;

    if (!activity.map?.polyline && !activity.map?.summary_polyline) {
      console.log(`[Strava] Activity ${activityId} has no polyline data (indoor activity?)`);
      return;
    }

    const polylineStr = activity.map.polyline || activity.map.summary_polyline;
    const decoded = polylineCodec.decode(polylineStr, 5);
    const coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat]);

    if (coordinates.length < 3) {
      console.log(`[Strava] Activity ${activityId} has too few coordinates`);
      return;
    }

    const distance = calculateDistance(coordinates);
    const closedLoop = detectClosedLoop(coordinates);
    let polygon: number[][] | null = null;
    let areaSqMeters = 0;

    if (closedLoop) {
      polygon = closedLoop;
      areaSqMeters = calculateArea(polygon);
    }

    const neighborhoodName = detectNeighborhood(coordinates);
    const activityDate = activity.start_date ? new Date(activity.start_date) : new Date();
    const monthKey = getMonthKey(activityDate);
    const actName = activity.name || "Actividad de Strava";

    await storage.createActivity(
      tokenRecord.userId,
      actName,
      coordinates,
      polygon,
      areaSqMeters,
      distance,
      neighborhoodName,
      monthKey
    );
    await storage.updateUserArea(tokenRecord.userId);

    console.log(`[Strava] Processed activity "${actName}" for user ${tokenRecord.userId} (${areaSqMeters.toFixed(0)} m², ${(distance / 1000).toFixed(1)} km)`);
  } catch (error: any) {
    console.error(`[Strava] Error processing activity ${activityId}:`, error.message);
  }
}

export function registerStravaRoutes(app: Express): void {
  app.get("/api/strava/auth-url", (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Debes iniciar sesión primero" });
    }
    if (!STRAVA_CLIENT_ID) {
      return res.status(500).json({ message: "Strava no configurado en el servidor" });
    }
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/strava/callback`;
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=activity:read_all&approval_prompt=auto`;
    return res.json({ url });
  });

  app.get("/api/strava/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const userId = req.session?.userId;

    if (!userId) {
      return res.redirect("/?strava=error&reason=not_logged_in");
    }

    if (error === "access_denied") {
      return res.redirect(`/profile/${userId}?strava=denied`);
    }

    if (!code) {
      return res.redirect(`/profile/${userId}?strava=error&reason=no_code`);
    }

    try {
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        console.error("[Strava] Token exchange failed:", await tokenRes.text());
        return res.redirect("/?strava=error&reason=token_exchange_failed");
      }

      const tokenData = await tokenRes.json() as any;
      const athleteId = tokenData.athlete?.id;

      if (!athleteId) {
        return res.redirect("/?strava=error&reason=no_athlete_id");
      }

      await storage.upsertStravaToken(
        userId,
        athleteId,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.expires_at
      );

      console.log(`[Strava] Connected athlete ${athleteId} to user ${userId}`);
      return res.redirect(`/profile/${userId}?strava=connected`);
    } catch (error: any) {
      console.error("[Strava] Callback error:", error.message);
      return res.redirect(`/profile/${userId}?strava=error&reason=server_error`);
    }
  });

  app.get("/api/strava/status", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ connected: false });

    const token = await storage.getStravaToken(userId);
    return res.json({ connected: !!token, athleteId: token?.stravaAthleteId || null });
  });

  app.post("/api/strava/disconnect", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "No autorizado" });

    await storage.deleteStravaToken(userId);
    return res.json({ message: "Strava desconectado" });
  });

  app.post("/api/strava/sync", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "No autorizado" });

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return res.status(400).json({ message: "No hay conexión con Strava activa" });
    }

    try {
      const after = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
      const activitiesRes = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!activitiesRes.ok) {
        return res.status(400).json({ message: "Error al obtener actividades de Strava" });
      }

      const stravaActivities = await activitiesRes.json() as any[];
      let imported = 0;

      for (const act of stravaActivities) {
        if (!act.map?.polyline && !act.map?.summary_polyline) continue;

        const polylineStr = act.map.polyline || act.map.summary_polyline;
        const decoded = polylineCodec.decode(polylineStr, 5);
        const coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat]);

        if (coordinates.length < 3) continue;

        const distance = calculateDistance(coordinates);
        const closedLoop = detectClosedLoop(coordinates);
        let polygon: number[][] | null = null;
        let areaSqMeters = 0;

        if (closedLoop) {
          polygon = closedLoop;
          areaSqMeters = calculateArea(polygon);
        }

        const neighborhoodName = detectNeighborhood(coordinates);
        const activityDate = act.start_date ? new Date(act.start_date) : new Date();
        const monthKey = getMonthKey(activityDate);

        await storage.createActivity(
          userId,
          act.name || "Actividad de Strava",
          coordinates,
          polygon,
          areaSqMeters,
          distance,
          neighborhoodName,
          monthKey
        );
        imported++;
      }

      if (imported > 0) {
        await storage.updateUserArea(userId);
      }

      return res.json({ message: `${imported} actividades importadas de Strava`, count: imported });
    } catch (error: any) {
      console.error("[Strava] Sync error:", error.message);
      return res.status(500).json({ message: "Error al sincronizar con Strava" });
    }
  });

  app.get("/api/strava/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (mode === "subscribe" && token === STRAVA_VERIFY_TOKEN) {
      console.log("[Strava] Webhook subscription validated");
      return res.json({ "hub.challenge": challenge });
    }
    return res.sendStatus(403);
  });

  app.post("/api/strava/webhook", async (req: Request, res: Response) => {
    res.status(200).send("EVENT_RECEIVED");

    const event = req.body;
    console.log("[Strava] Webhook event:", JSON.stringify(event));

    if (event.object_type === "activity" && event.aspect_type === "create") {
      const ownerId = event.owner_id;
      const objectId = event.object_id;
      setTimeout(() => processStravaActivity(ownerId, objectId), 2000);
    }
  });
}
