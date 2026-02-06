import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, ArrowLeft, MapPin, Crown, Medal, Calendar, Map, ChevronLeft, ChevronRight, Award, Users, Zap, Percent } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Activity, MonthlyTitle } from "@shared/schema";
import BarcelonaMap from "@/components/barcelona-map";
import UserSearch from "@/components/user-search";
import { useState, useMemo } from "react";

type RankedUser = {
  id?: string;
  userId?: string;
  username: string;
  totalAreaSqMeters: number;
  rank: number;
};

type LiveRankedUser = {
  userId: string;
  username: string;
  paintColor: string;
  territorySqMeters: number;
  territoryPercent: number;
  rank: number;
};

type TerritoryData = {
  userId: string;
  username: string;
  paintColor: string;
  polygons: number[][][];
};

type NeighborhoodRanking = {
  neighborhoodName: string;
  topUser: string;
  topUserId: string;
  totalAreaSqMeters: number;
  runnerCount: number;
};

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("es")} m²`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

const PODIUM_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const PODIUM_LABELS = ["Oro", "Plata", "Bronce"];

function MonthSelector({ monthKey, onChange }: { monthKey: string; onChange: (mk: string) => void }) {
  const goBack = () => {
    const [y, m] = monthKey.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    onChange(getMonthKey(prev));
  };
  const goForward = () => {
    const [y, m] = monthKey.split("-").map(Number);
    const next = new Date(y, m, 1);
    const current = getMonthKey(new Date());
    const nextKey = getMonthKey(next);
    if (nextKey <= current) onChange(nextKey);
  };
  const currentMonth = getMonthKey(new Date());

  return (
    <div className="flex items-center gap-2" data-testid="month-selector">
      <Button variant="ghost" size="icon" onClick={goBack} data-testid="button-month-prev">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-1.5 min-w-[100px] justify-center">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{formatMonth(monthKey)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={goForward}
        disabled={monthKey >= currentMonth}
        data-testid="button-month-next"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function RankingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"global" | "neighborhoods" | "global-live">("global-live");
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);

  const { data: globalRankings = [], isLoading: globalLoading } = useQuery<RankedUser[]>({
    queryKey: ["/api/rankings", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/rankings?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading rankings");
      return res.json();
    },
    enabled: tab === "global",
  });

  const { data: neighborhoodRankings = [], isLoading: neighborhoodLoading } = useQuery<NeighborhoodRanking[]>({
    queryKey: ["/api/rankings/neighborhoods", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/neighborhoods?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading neighborhood rankings");
      return res.json();
    },
    enabled: tab === "neighborhoods",
  });

  const { data: neighborhoodLeaderboard = [] } = useQuery<RankedUser[]>({
    queryKey: ["/api/rankings/neighborhoods", selectedNeighborhood, "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/neighborhoods/${encodeURIComponent(selectedNeighborhood!)}?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading leaderboard");
      return res.json();
    },
    enabled: tab === "neighborhoods" && !!selectedNeighborhood,
  });

  const { data: liveRankings = [], isLoading: liveLoading } = useQuery<LiveRankedUser[]>({
    queryKey: ["/api/rankings/global-live", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/global-live?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading live rankings");
      return res.json();
    },
    enabled: tab === "global-live",
  });

  const { data: liveTerritoriesData = [] } = useQuery<TerritoryData[]>({
    queryKey: ["/api/rankings/global-live/territories", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/global-live/territories?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading territories");
      return res.json();
    },
    enabled: tab === "global-live",
  });

  const activeUserId = tab === "global"
    ? selectedUserId
    : tab === "neighborhoods"
    ? (selectedUserId || (neighborhoodLeaderboard.length > 0 ? (neighborhoodLeaderboard[0].userId || neighborhoodLeaderboard[0].id) : null))
    : selectedUserId;

  const { data: selectedActivities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/users", activeUserId, "activities", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/users/${activeUserId}/activities?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading activities");
      return res.json();
    },
    enabled: !!activeUserId && tab !== "global-live",
  });

  const { data: selectedUserTitles = [] } = useQuery<MonthlyTitle[]>({
    queryKey: ["/api/users", activeUserId, "titles"],
    enabled: !!activeUserId && tab === "global",
  });

  const { data: participantCount } = useQuery<{ count: number }>({
    queryKey: ["/api/rankings/participant-count", "month", monthKey],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/participant-count?month=${monthKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const isLoading = tab === "global" ? globalLoading : tab === "neighborhoods" ? neighborhoodLoading : liveLoading;

  const globalPodium = useMemo(() => {
    return globalRankings.slice(0, 3).map(u => ({
      ...u,
      id: u.id || u.userId || "",
    }));
  }, [globalRankings]);

  const globalRest = useMemo(() => {
    return globalRankings.slice(3).map(u => ({
      ...u,
      id: u.id || u.userId || "",
    }));
  }, [globalRankings]);

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
            <span className="text-xl font-bold tracking-tight hidden sm:inline">
              <span className="text-primary">paint</span>run<span className="text-primary font-black">BCN</span>
            </span>
          </div>
          <UserSearch className="w-48 lg:w-64" />
          <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={tab === "global-live" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setTab("global-live"); setSelectedNeighborhood(null); setSelectedUserId(null); }}
            data-testid="button-tab-global-live"
          >
            <Zap className="w-4 h-4" /> GLOBAL LIVE
          </Button>
          <Button
            variant={tab === "global" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setTab("global"); setSelectedNeighborhood(null); setSelectedUserId(null); }}
            data-testid="button-tab-global"
          >
            <Trophy className="w-4 h-4" /> Ranking Global
          </Button>
          <Button
            variant={tab === "neighborhoods" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setTab("neighborhoods"); setSelectedUserId(null); }}
            data-testid="button-tab-neighborhoods"
          >
            <Map className="w-4 h-4" /> Por Barrios
          </Button>
          {participantCount && (
            <Badge variant="secondary" className="gap-1 ml-auto" data-testid="badge-participant-count">
              <Users className="w-3 h-3" />
              {participantCount.count} participante{participantCount.count !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-120px)] overflow-hidden">
        <aside className="lg:w-96 border-b lg:border-b-0 lg:border-r bg-card/50 p-4 overflow-y-auto max-h-[50vh] lg:max-h-none">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tab === "global-live" ? (
            <GlobalLiveRankingList
              rankings={liveRankings}
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
            />
          ) : tab === "global" ? (
            <GlobalRankingList
              podium={globalPodium}
              rest={globalRest}
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
              titles={selectedUserTitles}
            />
          ) : selectedNeighborhood ? (
            <NeighborhoodLeaderboardView
              name={selectedNeighborhood}
              leaderboard={neighborhoodLeaderboard}
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
              onBack={() => { setSelectedNeighborhood(null); setSelectedUserId(null); }}
            />
          ) : (
            <NeighborhoodsList
              rankings={neighborhoodRankings}
              onSelectNeighborhood={setSelectedNeighborhood}
            />
          )}
        </aside>

        <main className="flex-1 relative min-h-[50vh] lg:min-h-0">
          {tab === "global-live" ? (
            <BarcelonaMap
              className="w-full h-full"
              interactive={true}
              territories={liveTerritoriesData}
              highlightUserId={selectedUserId}
            />
          ) : activeUserId ? (
            <BarcelonaMap
              activities={selectedActivities}
              className="w-full h-full"
              interactive={true}
              intensityMode={true}
              highlightNeighborhood={selectedNeighborhood}
              userColor={
                tab === "global" && globalPodium.findIndex((u) => u.id === selectedUserId) >= 0
                  ? PODIUM_COLORS[globalPodium.findIndex((u) => u.id === selectedUserId)]
                  : "#FF6B35"
              }
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <BarcelonaMap
                className="w-full h-full"
                interactive={true}
                highlightNeighborhood={selectedNeighborhood}
              />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm p-6 rounded-md text-center pointer-events-none">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {tab === "neighborhoods" ? "Selecciona un barrio" : "Selecciona un runner"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tab === "neighborhoods" ? "para ver su ranking" : "para ver sus áreas pintadas"}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function GlobalLiveRankingList({
  rankings,
  selectedUserId,
  onSelectUser,
}: {
  rankings: LiveRankedUser[];
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
}) {
  if (rankings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Sin territorios este mes</p>
        <p className="text-xs mt-1">Sube una actividad para reclamar terreno</p>
      </div>
    );
  }

  const podium = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">GLOBAL LIVE</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Territorio actual: el que pinta último se queda con la zona. Los territorios cambian con cada nueva actividad.
        </p>
      </div>

      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {podium.map((u, i) => (
            <button
              key={u.userId}
              onClick={() => onSelectUser(selectedUserId === u.userId ? null : u.userId)}
              className={`flex flex-col items-center p-3 rounded-md transition-colors ${
                selectedUserId === u.userId ? "bg-accent" : "hover-elevate"
              }`}
              data-testid={`button-live-podium-${i + 1}`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5"
                style={{ backgroundColor: u.paintColor + "30", color: u.paintColor }}
              >
                {i === 0 ? <Crown className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
              </div>
              <Link href={`/profile/${u.userId}`}>
                <span className="text-xs font-bold truncate w-full text-center hover:underline">{u.username}</span>
              </Link>
              <span className="text-[10px] text-muted-foreground mt-0.5">{formatArea(u.territorySqMeters)}</span>
              <Badge
                variant="secondary"
                className="mt-1 text-[10px] gap-0.5"
              >
                <Percent className="w-2.5 h-2.5" />
                {u.territoryPercent}%
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {rest.map((u) => (
          <button
            key={u.userId}
            onClick={() => onSelectUser(selectedUserId === u.userId ? null : u.userId)}
            className={`w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left ${
              selectedUserId === u.userId ? "bg-accent" : "hover-elevate"
            }`}
            data-testid={`button-live-user-${u.userId}`}
          >
            <span className="text-sm font-bold text-muted-foreground w-6 text-right">
              {u.rank}
            </span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: u.paintColor + "25" }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: u.paintColor }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${u.userId}`}>
                <p className="font-medium text-sm truncate hover:underline">{u.username}</p>
              </Link>
              <p className="text-[10px] text-muted-foreground">
                {u.territoryPercent}% de Barcelona
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {formatArea(u.territorySqMeters)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function TitlesBadges({ titles }: { titles: MonthlyTitle[] }) {
  if (titles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {titles.slice(0, 5).map((t) => (
        <Badge key={t.id} variant="secondary" className="text-[10px] gap-1">
          <Award className="w-2.5 h-2.5" />
          {t.titleType === "global" ? "Global" : t.neighborhoodName || "Barri"}
          {" "}{formatMonth(t.monthKey)}
        </Badge>
      ))}
      {titles.length > 5 && (
        <Badge variant="secondary" className="text-[10px]">+{titles.length - 5}</Badge>
      )}
    </div>
  );
}

function GlobalRankingList({
  podium,
  rest,
  selectedUserId,
  onSelectUser,
  titles,
}: {
  podium: (RankedUser & { id: string })[];
  rest: (RankedUser & { id: string })[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  titles: MonthlyTitle[];
}) {
  if (podium.length === 0 && rest.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Aún no hay runners este mes</p>
        <p className="text-xs mt-1">Sé el primero en pintar Barcelona</p>
      </div>
    );
  }

  return (
    <>
      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {podium.map((u, i) => (
            <button
              key={u.id}
              onClick={() => onSelectUser(u.id)}
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
              <Link href={`/profile/${u.id}`}>
                <span className="text-xs font-bold truncate w-full text-center hover:underline">{u.username}</span>
              </Link>
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
      )}

      {selectedUserId && titles.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" /> Títulos ganados
          </p>
          <TitlesBadges titles={titles} />
        </div>
      )}

      <div className="space-y-1.5">
        {rest.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelectUser(u.id)}
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
              <Link href={`/profile/${u.id}`}>
                <p className="font-medium text-sm truncate hover:underline">{u.username}</p>
              </Link>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {formatArea(u.totalAreaSqMeters)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function NeighborhoodsList({
  rankings,
  onSelectNeighborhood,
}: {
  rankings: NeighborhoodRanking[];
  onSelectNeighborhood: (name: string) => void;
}) {
  if (rankings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Map className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Sin actividad este mes en ningún barrio</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
        Barrios con actividad
      </p>
      {rankings.map((n) => (
        <button
          key={n.neighborhoodName}
          onClick={() => onSelectNeighborhood(n.neighborhoodName)}
          className="w-full flex items-center gap-3 p-3 rounded-md text-left hover-elevate"
          data-testid={`button-neighborhood-${n.neighborhoodName}`}
        >
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Map className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{n.neighborhoodName}</p>
            <p className="text-[10px] text-muted-foreground">
              {n.runnerCount} runner{n.runnerCount !== 1 ? "s" : ""} &middot; Líder: {n.topUser}
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatArea(n.totalAreaSqMeters)}
          </span>
        </button>
      ))}
    </div>
  );
}

function NeighborhoodLeaderboardView({
  name,
  leaderboard,
  selectedUserId,
  onSelectUser,
  onBack,
}: {
  name: string;
  leaderboard: RankedUser[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover-elevate rounded-md p-1.5"
        data-testid="button-back-neighborhoods"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Todos los barrios
      </button>
      <div className="mb-4">
        <h3 className="font-bold text-lg">{name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ranking del barrio (pinturas repetidas cuentan)
        </p>
      </div>
      {leaderboard.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin actividad este mes</p>
      ) : (
        <div className="space-y-1.5">
          {leaderboard.map((u, i) => {
            const uid = u.userId || u.id || "";
            return (
              <button
                key={uid}
                onClick={() => onSelectUser(uid)}
                className={`w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left ${
                  selectedUserId === uid ? "bg-accent" : "hover-elevate"
                }`}
                data-testid={`button-leaderboard-${uid}`}
              >
                <span className="text-sm font-bold text-muted-foreground w-6 text-right">
                  {i + 1}
                </span>
                {i < 3 && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: PODIUM_COLORS[i] + "20", color: PODIUM_COLORS[i] }}
                  >
                    {i === 0 ? <Crown className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" />}
                  </div>
                )}
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {u.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${uid}`}>
                    <p className="font-medium text-sm truncate hover:underline">{u.username}</p>
                  </Link>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatArea(u.totalAreaSqMeters)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
