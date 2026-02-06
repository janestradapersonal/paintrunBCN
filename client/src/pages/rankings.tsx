import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, ArrowLeft, MapPin, Crown, Medal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Activity } from "@shared/schema";
import BarcelonaMap from "@/components/barcelona-map";
import { useState } from "react";

type RankedUser = {
  id: string;
  username: string;
  totalAreaSqMeters: number;
  rank: number;
  activities?: Activity[];
};

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("es")} m²`;
}

const PODIUM_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const PODIUM_LABELS = ["Oro", "Plata", "Bronce"];

export default function RankingsPage() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: rankings = [], isLoading } = useQuery<RankedUser[]>({
    queryKey: ["/api/rankings"],
  });

  const { data: selectedActivities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/users", selectedUserId, "activities"],
    enabled: !!selectedUserId,
  });

  const podium = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href={user ? "/dashboard" : "/"}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">paint</span>run<span className="text-primary font-black">BCN</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="font-semibold">Ranking Global</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-57px)]">
        <aside className="lg:w-96 border-b lg:border-b-0 lg:border-r bg-card/50 p-4 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Aún no hay runners en el ranking</p>
              <p className="text-xs mt-1">Sé el primero en pintar Barcelona</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {podium.map((u, i) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`flex flex-col items-center p-3 rounded-md transition-colors ${
                      selectedUserId === u.id ? "bg-accent" : "hover-elevate"
                    }`}
                    data-testid={`button-podium-${i + 1}`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5"
                      style={{ backgroundColor: PODIUM_COLORS[i] + "20", color: PODIUM_COLORS[i] }}
                    >
                      {i === 0 ? <Crown className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
                    </div>
                    <span className="text-xs font-bold truncate w-full text-center">{u.username}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{formatArea(u.totalAreaSqMeters)}</span>
                    <Badge
                      variant="secondary"
                      className="mt-1 text-[10px]"
                      style={{ borderColor: PODIUM_COLORS[i] + "40" }}
                    >
                      {PODIUM_LABELS[i]}
                    </Badge>
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {rest.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left ${
                      selectedUserId === u.id ? "bg-accent" : "hover-elevate"
                    }`}
                    data-testid={`button-user-${u.id}`}
                  >
                    <span className="text-sm font-bold text-muted-foreground w-6 text-right">
                      {u.rank}
                    </span>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {u.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{u.username}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {formatArea(u.totalAreaSqMeters)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 relative">
          {selectedUserId ? (
            <BarcelonaMap
              activities={selectedActivities}
              className="w-full h-full min-h-[400px] lg:min-h-0"
              interactive={true}
              userColor={
                podium.findIndex((u) => u.id === selectedUserId) >= 0
                  ? PODIUM_COLORS[podium.findIndex((u) => u.id === selectedUserId)]
                  : "#FF6B35"
              }
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <BarcelonaMap
                className="w-full h-full min-h-[400px] lg:min-h-0"
                interactive={true}
              />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm p-6 rounded-md text-center pointer-events-none">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-foreground">Selecciona un runner</p>
                <p className="text-xs text-muted-foreground mt-1">para ver sus áreas pintadas</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
