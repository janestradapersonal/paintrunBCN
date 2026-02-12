import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import type { Activity, MonthlyTitle } from "@shared/schema";
import BarcelonaMap from "@/components/barcelona-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  MapPin,
  Trophy,
  Ruler,
  Award,
  Users,
  UserPlus,
  UserMinus,
  Activity as ActivityIcon,
  Calendar,
  Loader2,
  Palette,
  Check,
  ChevronLeft,
  ChevronRight,
  Unlink,
  RefreshCw,
  Link as LinkIcon,
} from "lucide-react";
import { SiStrava, SiGarmin } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { MobilePanelToggle, getMobilePanelClasses, type PanelMode } from "@/components/mobile-panel-toggle";

const PRESET_COLORS = [
  "#FF6B35", "#E53E3E", "#DD6B20", "#D69E2E",
  "#38A169", "#319795", "#3182CE", "#5A67D8",
  "#805AD5", "#D53F8C", "#ED64A6", "#00E5FF",
  "#76FF03", "#FFD600", "#FF3D00", "#FFFFFF",
];

type UserProfile = {
  id: string;
  username: string;
  totalAreaSqMeters: number;
  paintColor: string;
  createdAt: string;
  activityCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

type FollowUser = {
  id: string;
  username: string;
  totalAreaSqMeters: number;
};

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("es")} m²`;
}

function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId || "";
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [followPending, setFollowPending] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [panelMode, setPanelMode] = useState<PanelMode>("list");

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users", userId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading profile");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: userActivities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/users", userId, "activities", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/activities?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading activities");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: titles = [] } = useQuery<MonthlyTitle[]>({
    queryKey: ["/api/users", userId, "titles"],
    enabled: !!userId,
  });

  const { data: followers = [] } = useQuery<FollowUser[]>({
    queryKey: ["/api/users", userId, "followers"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/followers`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading followers");
      return res.json();
    },
    enabled: !!userId && showFollowers,
  });

  const { data: following = [] } = useQuery<FollowUser[]>({
    queryKey: ["/api/users", userId, "following"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/following`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading following");
      return res.json();
    },
    enabled: !!userId && showFollowing,
  });

  const handleFollow = async () => {
    if (!user || followPending) return;
    setFollowPending(true);
    try {
      if (profile?.isFollowing) {
        await apiRequest("POST", `/api/users/${userId}/unfollow`);
      } else {
        await apiRequest("POST", `/api/users/${userId}/follow`);
      }
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "followers"] });
    } finally {
      setFollowPending(false);
    }
  };

  const isOwnProfile = user?.id === userId;

  const { data: stravaStatus } = useQuery<{ connected: boolean; athleteId: number | null }>({
    queryKey: ["/api/strava/status"],
    queryFn: async () => {
      const res = await fetch("/api/strava/status", { credentials: "include" });
      if (!res.ok) return { connected: false, athleteId: null };
      return res.json();
    },
    enabled: isOwnProfile,
  });

  const [stravaSyncing, setStravaSyncing] = useState(false);

  const handleStravaConnect = async () => {
    try {
      const res = await fetch("/api/strava/auth-url", { credentials: "include" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Error", description: "No se pudo iniciar la conexión con Strava", variant: "destructive" });
    }
  };

  const handleStravaDisconnect = async () => {
    try {
      await apiRequest("POST", "/api/strava/disconnect");
      qc.invalidateQueries({ queryKey: ["/api/strava/status"] });
      toast({ title: "Strava desconectado", description: "Tu cuenta de Strava ha sido desvinculada." });
    } catch {
      toast({ title: "Error", description: "No se pudo desconectar Strava", variant: "destructive" });
    }
  };

  const handleStravaSync = async () => {
    setStravaSyncing(true);
    try {
      const res = await apiRequest("POST", "/api/strava/sync");
      const data = await res.json();
      toast({ title: "Sincronización completada", description: data.message });
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "activities"] });
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
    } catch {
      toast({ title: "Error", description: "No se pudo sincronizar con Strava", variant: "destructive" });
    } finally {
      setStravaSyncing(false);
    }
  };

  const handleColorChange = async (color: string) => {
    setSavingColor(true);
    try {
      await apiRequest("PUT", "/api/users/me/paint-color", { color });
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Color actualizado", description: "Tu nuevo color de pintura se ha guardado." });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el color", variant: "destructive" });
    } finally {
      setSavingColor(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Usuario no encontrado</p>
            <Link href="/">
              <Button variant="ghost" className="mt-4">Volver</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const globalTitles = titles.filter(t => t.titleType === "global");
  const neighborhoodTitles = titles.filter(t => t.titleType === "neighborhood");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-profile">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">paint</span>run<span className="text-primary font-black">BCN</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1" data-testid="month-selector-profile">
              <Button variant="ghost" size="icon" onClick={() => {
                const [y, m] = monthKey.split("-").map(Number);
                const prev = new Date(y, m - 2, 1);
                setMonthKey(getMonthKey(prev));
              }} data-testid="button-month-prev">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1.5 min-w-[90px] justify-center">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{formatMonth(monthKey)}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => {
                const [y, m] = monthKey.split("-").map(Number);
                const next = new Date(y, m, 1);
                const currentMonth = getMonthKey(new Date());
                const nextKey = getMonthKey(next);
                if (nextKey <= currentMonth) setMonthKey(nextKey);
              }} disabled={monthKey >= getMonthKey(new Date())} data-testid="button-month-next">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {user && !isOwnProfile && (
              <Button
                variant={profile.isFollowing ? "secondary" : "default"}
                size="sm"
                className="gap-1.5"
                onClick={handleFollow}
                disabled={followPending}
                data-testid="button-follow-toggle"
              >
                {followPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : profile.isFollowing ? (
                  <UserMinus className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {profile.isFollowing ? "Dejar de seguir" : "Seguir"}
              </Button>
            )}
            {isOwnProfile && (
              <Badge variant="secondary" className="gap-1.5">
                Tu perfil
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
        <aside className={`lg:w-96 border-b lg:border-b-0 lg:border-r bg-card/50 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 transition-all duration-300 ${getMobilePanelClasses(panelMode).aside}`}>
          <div className="flex flex-col items-center text-center gap-3">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {profile.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold" data-testid="text-profile-username">{profile.username}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-1">
                <Calendar className="w-3 h-3" />
                Miembro desde {formatDate(profile.createdAt)}
              </p>
            </div>
            {isOwnProfile && (
              <div className="w-full">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-2 mx-auto text-xs text-muted-foreground hover-elevate rounded-md px-3 py-1.5"
                  data-testid="button-color-picker-toggle"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: profile.paintColor }}
                  />
                  <Palette className="w-3.5 h-3.5" />
                  Cambiar color de pintura
                </button>
                {showColorPicker && (
                  <Card className="mt-2">
                    <CardContent className="p-3">
                      <div className="grid grid-cols-8 gap-1.5" data-testid="color-picker-grid">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => handleColorChange(c)}
                            disabled={savingColor}
                            className={`w-7 h-7 rounded-md border-2 transition-transform flex items-center justify-center ${
                              profile.paintColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: c }}
                            data-testid={`button-color-${c.replace("#", "")}`}
                          >
                            {profile.paintColor === c && (
                              <Check className={`w-3.5 h-3.5 ${c === "#FFFFFF" || c === "#FFD600" || c === "#76FF03" ? "text-black" : "text-white"}`} />
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground">Personalizado:</label>
                        <input
                          type="color"
                          value={profile.paintColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="w-7 h-7 rounded-md border border-border cursor-pointer bg-transparent"
                          data-testid="input-custom-color"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {isOwnProfile && (
              <Card className="w-full">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">Conexiones</span>
                  </div>
                  <div className="space-y-2">
                    {stravaStatus?.connected ? (
                      <div className="rounded-md border border-border p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <SiStrava className="w-4 h-4 text-[#FC4C02]" />
                            <span className="text-xs font-medium">Strava</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] gap-1" data-testid="badge-strava-connected">
                            <Check className="w-3 h-3" /> Conectado
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5 flex-1"
                            onClick={handleStravaSync}
                            disabled={stravaSyncing}
                            data-testid="button-strava-sync"
                          >
                            {stravaSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Sincronizar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={handleStravaDisconnect}
                            data-testid="button-strava-disconnect"
                          >
                            <Unlink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleStravaConnect}
                        className="w-full flex items-center gap-3 rounded-md border border-border p-2.5 hover-elevate active-elevate-2 transition-colors"
                        data-testid="button-strava-connect"
                      >
                        <SiStrava className="w-5 h-5 text-[#FC4C02]" />
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-medium">Conectar Strava</span>
                          <span className="text-[10px] text-muted-foreground">Importar actividades</span>
                        </div>
                      </button>
                    )}
                    <button
                      onClick={() => toast({ title: "Garmin Connect", description: "La conexión con Garmin estará disponible próximamente." })}
                      className="w-full flex items-center gap-3 rounded-md border border-border p-2.5 hover-elevate active-elevate-2 transition-colors"
                      data-testid="button-garmin-connect"
                    >
                      <SiGarmin className="w-5 h-5 text-[#007CC3]" />
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-medium">Conectar Garmin</span>
                        <span className="text-[10px] text-muted-foreground">Importar actividades</span>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
            {!isOwnProfile && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: profile.paintColor }}
                />
                Color de pintura
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 flex flex-col items-center text-center">
                <Ruler className="w-4 h-4 text-primary mb-1" />
                <span className="text-[10px] text-muted-foreground">Área total</span>
                <span className="text-sm font-bold" data-testid="text-profile-area">
                  {formatArea(profile.totalAreaSqMeters)}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex flex-col items-center text-center">
                <ActivityIcon className="w-4 h-4 text-primary mb-1" />
                <span className="text-[10px] text-muted-foreground">Actividades</span>
                <span className="text-sm font-bold" data-testid="text-profile-activities">
                  {profile.activityCount}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex flex-col items-center text-center">
                <Trophy className="w-4 h-4 text-primary mb-1" />
                <span className="text-[10px] text-muted-foreground">Títulos</span>
                <span className="text-sm font-bold" data-testid="text-profile-titles-count">
                  {titles.length}
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowFollowers(!showFollowers); setShowFollowing(false); }}
              className={`flex-1 flex flex-col items-center p-2 rounded-md transition-colors ${showFollowers ? "bg-accent" : "hover-elevate"}`}
              data-testid="button-show-followers"
            >
              <span className="text-sm font-bold" data-testid="text-follower-count">{profile.followerCount}</span>
              <span className="text-[10px] text-muted-foreground">Seguidores</span>
            </button>
            <button
              onClick={() => { setShowFollowing(!showFollowing); setShowFollowers(false); }}
              className={`flex-1 flex flex-col items-center p-2 rounded-md transition-colors ${showFollowing ? "bg-accent" : "hover-elevate"}`}
              data-testid="button-show-following"
            >
              <span className="text-sm font-bold" data-testid="text-following-count">{profile.followingCount}</span>
              <span className="text-[10px] text-muted-foreground">Siguiendo</span>
            </button>
          </div>

          {showFollowers && (
            <Card>
              <CardContent className="p-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Seguidores ({followers.length})
                </h3>
                {followers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Aún no tiene seguidores</p>
                ) : (
                  <div className="space-y-1">
                    {followers.map(f => (
                      <Link key={f.id} href={`/profile/${f.id}`}>
                        <div className="flex items-center gap-2 p-1.5 rounded-md hover-elevate" data-testid={`link-follower-${f.id}`}>
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {f.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{f.username}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showFollowing && (
            <Card>
              <CardContent className="p-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Siguiendo ({following.length})
                </h3>
                {following.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No sigue a nadie</p>
                ) : (
                  <div className="space-y-1">
                    {following.map(f => (
                      <Link key={f.id} href={`/profile/${f.id}`}>
                        <div className="flex items-center gap-2 p-1.5 rounded-md hover-elevate" data-testid={`link-following-${f.id}`}>
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {f.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{f.username}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {titles.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Vitrina de trofeos
                </h3>
                {globalTitles.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Global</p>
                    <div className="flex flex-wrap gap-1.5">
                      {globalTitles.map(t => (
                        <Badge key={t.id} variant="secondary" className="text-[10px] gap-1" data-testid={`badge-title-${t.id}`}>
                          <Trophy className="w-2.5 h-2.5" />
                          #{t.rank} {formatMonth(t.monthKey)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {neighborhoodTitles.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Barrios</p>
                    <div className="flex flex-wrap gap-1.5">
                      {neighborhoodTitles.map(t => (
                        <Badge key={t.id} variant="secondary" className="text-[10px] gap-1" data-testid={`badge-title-${t.id}`}>
                          <MapPin className="w-2.5 h-2.5" />
                          #{t.rank} {t.neighborhoodName} {formatMonth(t.monthKey)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ActivityIcon className="w-4 h-4" />
              Actividades {formatMonth(monthKey)} ({userActivities.length})
            </h3>
            {activitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : userActivities.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Sin actividades</p>
            ) : (
              <div className="space-y-2">
                {userActivities.map(activity => (
                  <Card key={activity.id} className="hover-elevate">
                    <CardContent className="p-3">
                      <p className="font-medium text-sm truncate" data-testid={`text-activity-${activity.id}`}>
                        {activity.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Ruler className="w-3 h-3" />
                          {formatArea(activity.areaSqMeters)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {formatDistance(activity.distanceMeters)}
                        </span>
                        {activity.neighborhoodName && (
                          <Badge variant="secondary" className="text-[10px]">
                            {activity.neighborhoodName}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </aside>

        <MobilePanelToggle mode={panelMode} onToggle={setPanelMode} />

        <main className={`relative lg:flex-1 shrink-0 transition-all duration-300 ${getMobilePanelClasses(panelMode).main}`}>
          <BarcelonaMap
            activities={userActivities}
            className="w-full h-full"
            interactive={true}
            userColor={profile.paintColor}
            intensityMode={true}
          />
        </main>
      </div>
    </div>
  );
}
