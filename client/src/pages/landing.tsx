import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Activity, MonthlyTitle } from "@shared/schema";
import BarcelonaMap from "@/components/barcelona-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  MapPin,
  Trophy,
  LogOut,
  Loader2,
  FileUp,
  Ruler,
  Activity as ActivityIcon,
  Award,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import UserSearch from "@/components/user-search";

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("es")} m²`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function LandingPage() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <DashboardView />;
  }

  return <WelcomeView />;
}

function WelcomeView() {
  return (
    <div className="fixed inset-0 bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <BarcelonaMap
          className="w-full h-full"
          interactive={false}
          showNeighborhoods={true}
        />
      </div>
      <div className="absolute inset-0 z-10 bg-background/60 pointer-events-none" />

      <div className="absolute inset-0 z-20 flex items-center justify-center px-4 pointer-events-none">
        <div className="flex flex-col items-center text-center max-w-md w-full bg-card/90 backdrop-blur-md border border-card-border rounded-md p-8 md:p-10 pointer-events-auto">
          <span className="text-3xl md:text-5xl font-black tracking-tight mb-3" data-testid="text-splash-logo">
            <span className="text-primary">paint</span>
            <span className="text-foreground">run</span>
            <span className="text-primary font-black">BCN</span>
          </span>
          <p className="text-muted-foreground text-sm md:text-base mb-8 leading-relaxed">
            Pinta Barcelona corriendo. Sube tus rutas, conquista barrios y compite por el mapa.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link href="/login">
              <Button size="lg" className="gap-2 text-base w-full" data-testid="button-enter-login">
                Entrar <LogIn className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg" className="gap-2 text-base w-full" data-testid="button-enter-register">
                Registrarse <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/rankings">
              <Button variant="ghost" size="lg" className="gap-2 text-base w-full" data-testid="button-enter-rankings">
                <Trophy className="w-4 h-4" /> Ver Ranking
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardView() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: profile } = useQuery<{ totalAreaSqMeters: number; rank: number; titles: MonthlyTitle[] }>({
    queryKey: ["/api/users/me/stats"],
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".gpx")) {
      toast({ title: "Error", description: "Solo se aceptan archivos GPX", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("gpx", file);
      const res = await fetch("/api/activities/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al subir archivo");
      }
      toast({ title: "Actividad subida", description: "Tu ruta ha sido procesada y pintada en el mapa." });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/stats"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (!user) return null;

  const titles = profile?.titles || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-xl font-bold tracking-tight" data-testid="text-logo">
            <span className="text-primary">paint</span>
            <span className="text-foreground">run</span>
            <span className="text-primary font-black">BCN</span>
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <UserSearch className="w-40 lg:w-52" />
            <Link href="/rankings">
              <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-rankings">
                <Trophy className="w-4 h-4" /> Ranking
              </Button>
            </Link>
            <Link href={`/profile/${user.id}`}>
              <Badge variant="secondary" className="gap-1.5 cursor-pointer">
                <MapPin className="w-3 h-3" />
                {user.username}
              </Badge>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside className="lg:w-80 border-b lg:border-b-0 lg:border-r bg-card/50 p-4 flex flex-col gap-4 overflow-y-auto max-h-[40vh] lg:max-h-none shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Ruler className="w-5 h-5 text-primary mb-1" />
                <span className="text-xs text-muted-foreground">Area pintada</span>
                <span className="text-lg font-bold" data-testid="text-total-area">
                  {profile ? formatArea(profile.totalAreaSqMeters) : "\u2014"}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Trophy className="w-5 h-5 text-primary mb-1" />
                <span className="text-xs text-muted-foreground">Posicion</span>
                <span className="text-lg font-bold" data-testid="text-rank">
                  {profile ? `#${profile.rank}` : "\u2014"}
                </span>
              </CardContent>
            </Card>
          </div>

          {titles.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Titulos ganados ({titles.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {titles.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-[10px] gap-1" data-testid={`badge-title-${t.id}`}>
                      <Award className="w-2.5 h-2.5" />
                      {t.titleType === "global"
                        ? `Global #${t.rank}`
                        : `${t.neighborhoodName} #${t.rank}`}
                      {" "}{formatMonth(t.monthKey)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".gpx"
              className="hidden"
              onChange={handleUpload}
              data-testid="input-gpx-file"
            />
            <Button
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="button-upload-gpx"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Subir actividad GPX
            </Button>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ActivityIcon className="w-4 h-4" />
              Mis actividades ({activities.length})
            </h3>
            {activitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aun no has subido ninguna actividad</p>
                <p className="text-xs mt-1">Exporta un GPX desde Strava y subelo aqui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <Card key={activity.id} className="hover-elevate">
                    <CardContent className="p-3">
                      <p className="font-medium text-sm truncate" data-testid={`text-activity-name-${activity.id}`}>
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

        <main className="flex-1 relative min-h-[50vh] lg:min-h-0">
          <BarcelonaMap
            activities={activities}
            className="w-full h-full"
            interactive={true}
            userColor={user.paintColor}
            intensityMode={true}
          />
        </main>
      </div>
    </div>
  );
}
