import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Trophy, ArrowLeft, MapPin, Crown, Medal, Calendar, Map as MapIcon, ChevronLeft, ChevronRight, Award, Users, Zap, Percent, Search, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Activity, MonthlyTitle } from "@shared/schema";
import BarcelonaMap from "@/components/barcelona-map";
import UserSearch from "@/components/user-search";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import GroupModal from "@/components/group-modal";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MobilePanelToggle, getMobilePanelClasses, type PanelMode } from "@/components/mobile-panel-toggle";

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

type LivePointsUser = {
  userId: string;
  username: string;
  paintColor: string;
  points: number;
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
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMonth, setShowMobileMonth] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showGroupsMenuDialog, setShowGroupsMenuDialog] = useState(false);
  const [showGroupsDialog, setShowGroupsDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [myGroups, setMyGroups] = useState<{ id: string; name: string; invite_code: string }[]>([]);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch('/api/groups/my', { credentials: 'include' });
        if (!r.ok) return;
        const data = await r.json();
        if (mounted) setMyGroups(data || []);
      } catch (e) {}
    };
    if (showGroupsDialog) load();
    return () => { mounted = false; };
  }, [showGroupsDialog]);
  const [groupContext, setGroupContext] = useState<{ type: "world" | "group"; groupId?: string }>(() => {
    try {
      const raw = localStorage.getItem("contextSelector");
      return raw ? JSON.parse(raw) : { type: "world" };
    } catch (e) {
      return { type: "world" };
    }
  });
  const [welcomeBanner, setWelcomeBanner] = useState<{ show: boolean; groupName: string; isFirstTime: boolean }>({ show: false, groupName: "", isFirstTime: false });
  const prevGroupContextRef = useRef<{ type: "world" | "group"; groupId?: string } | null>(null);

  // Check for pending welcome banner on mount (from group join via link/code)
  useEffect(() => {
    try {
      const pending = localStorage.getItem('pendingWelcomeBanner');
      if (pending) {
        const data = JSON.parse(pending);
        localStorage.removeItem('pendingWelcomeBanner');

        // Mark group as visited
        const visitedGroups = JSON.parse(localStorage.getItem("visitedGroups") || "[]");
        if (data.groupId && !visitedGroups.includes(data.groupId)) {
          const updatedVisited = [...visitedGroups, data.groupId];
          localStorage.setItem("visitedGroups", JSON.stringify(updatedVisited));
        }

        setWelcomeBanner({
          show: true,
          groupName: data.groupName || "tu grupo",
          isFirstTime: data.isFirstTime || false
        });

        // Auto-hide after 4 seconds
        setTimeout(() => {
          setWelcomeBanner(prev => ({ ...prev, show: false }));
        }, 4000);
      }
    } catch (e) {}
  }, []);

  const [tab, setTab] = useState<"global" | "neighborhoods" | "global-live">("global-live");
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("list");

  const { data: globalRankings = [], isLoading: globalLoading } = useQuery<RankedUser[]>({
    queryKey: ["/api/rankings", "month", monthKey],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings?${q.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading rankings");
      return res.json();
    },
    enabled: tab === "global",
  });

  const { data: neighborhoodRankings = [], isLoading: neighborhoodLoading } = useQuery<NeighborhoodRanking[]>({
    queryKey: ["/api/rankings/neighborhoods", "month", monthKey, groupContext],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings/neighborhoods?${q.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading neighborhood rankings");
      return res.json();
    },
    enabled: tab === "neighborhoods",
  });

  const { data: neighborhoodLeaderboard = [] } = useQuery<RankedUser[]>({
    queryKey: ["/api/rankings/neighborhoods", selectedNeighborhood, "month", monthKey, groupContext],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings/neighborhoods/${encodeURIComponent(selectedNeighborhood!)}?${q.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading leaderboard");
      return res.json();
    },
    enabled: tab === "neighborhoods" && !!selectedNeighborhood,
  });

  const { data: liveRankings = [], isLoading: liveLoading } = useQuery<LiveRankedUser[]>({
    queryKey: ["/api/rankings/global-live", "month", monthKey, groupContext],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings/global-live?${q.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading live rankings");
      return res.json();
    },
    enabled: tab === "global-live",
  });

  const { data: livePoints = [], isLoading: livePointsLoading } = useQuery<LivePointsUser[]>({
    queryKey: ["/api/rankings/global-live/points", "month", monthKey, groupContext],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings/global-live/points?${q.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading live points");
      return res.json();
    },
    enabled: tab === "global-live",
  });

  const { data: liveTerritoriesData = [] } = useQuery<TerritoryData[]>({
    queryKey: ["/api/rankings/global-live/territories", "month", monthKey, groupContext],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings/global-live/territories?${q.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error loading territories");
      return res.json();
    },
    enabled: tab === "global-live",
  });

  const { data: groupInfo } = useQuery<any>({
    queryKey: ["/api/groups", groupContext.groupId],
    queryFn: async () => {
      if (!groupContext || groupContext.type !== "group" || !groupContext.groupId) return null;
      const res = await fetch(`/api/groups/${groupContext.groupId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: groupContext.type === "group" && !!groupContext.groupId,
  });

  // Effect to detect group change and show welcome banner
  useEffect(() => {
    const prev = prevGroupContextRef.current;
    const current = groupContext;

    // Update reference
    prevGroupContextRef.current = current;

    // Skip on first render
    if (prev === null) return;

    // Check if group changed
    const prevId = prev.type === "group" ? prev.groupId : "world";
    const currentId = current.type === "group" ? current.groupId : "world";

    if (prevId !== currentId) {
      // Group or context changed
      if (current.type === "world") {
        setWelcomeBanner({ show: true, groupName: "Barcelona", isFirstTime: false });
      } else if (current.type === "group" && current.groupId) {
        // Check if there's a pending banner with the group name
        let pendingData: { groupId?: string; groupName?: string; isFirstTime?: boolean } | null = null;
        try {
          const pending = localStorage.getItem('pendingWelcomeBanner');
          if (pending) {
            pendingData = JSON.parse(pending);
            localStorage.removeItem('pendingWelcomeBanner');
          }
        } catch (e) {}

        // Check if it's first time entering this group
        const visitedGroups = JSON.parse(localStorage.getItem("visitedGroups") || "[]");
        const isFirstTime = pendingData?.isFirstTime || !visitedGroups.includes(current.groupId);

        if (isFirstTime && !visitedGroups.includes(current.groupId)) {
          const updatedVisited = [...visitedGroups, current.groupId];
          localStorage.setItem("visitedGroups", JSON.stringify(updatedVisited));
        }

        // Use pending data if available, otherwise fall back to myGroups or groupInfo
        const name = pendingData?.groupName ||
                     myGroups.find(g => g.id === current.groupId)?.name ||
                     groupInfo?.name ||
                     "tu grupo";
        setWelcomeBanner({ show: true, groupName: name, isFirstTime });
      }

      // Auto-hide banner after 4 seconds
      const timeout = setTimeout(() => {
        setWelcomeBanner(prev => ({ ...prev, show: false }));
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [groupContext, myGroups]);

  // Color palette for top N users in Global Live (distinct colors)
  const COLOR_PALETTE = [
    "#FF4500",
    "#1E90FF",
    "#32CD32",
    "#FFD700",
    "#8A2BE2",
    "#FF69B4",
    "#00CED1",
    "#FF8C00",
    "#ADFF2F",
    "#00BFFF",
    "#DC143C",
    "#20B2AA",
    "#DA70D6",
    "#B8860B",
    "#5F9EA0",
    "#FF1493",
    "#7CFC00",
    "#4169E1",
    "#FF6347",
    "#2E8B57",
  ];

  const colorOverrides = {} as Record<string, string>;
  // We'll order by points (from livePoints) for display; fall back to territory order
  const pointsMap = new Map<string, number>();
  if (livePoints) {
    for (const p of livePoints) pointsMap.set(p.userId, p.points || 0);
  }

  const liveRankingsByPoints = [...liveRankings].map((lr) => ({
    ...lr,
    points: pointsMap.get(lr.userId) || 0,
  })).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.territorySqMeters !== a.territorySqMeters ? b.territorySqMeters - a.territorySqMeters : a.username.localeCompare(b.username);
  });

  for (let i = 0; i < Math.min(COLOR_PALETTE.length, liveRankingsByPoints.length); i++) {
    const u = liveRankingsByPoints[i];
    if (u && u.userId) colorOverrides[u.userId] = COLOR_PALETTE[i];
  }

  // Build meta map for territories: points and percent
  const territoryMeta: Record<string, { points: number; percent: number }> = {};
  for (const lr of liveRankings) {
    const pts = pointsMap.get(lr.userId) || 0;
    territoryMeta[lr.userId] = { points: pts, percent: lr.territoryPercent };
  }

  const effectiveSelectedUserId = hoveredUserId || selectedUserId;

  const activeUserId = tab === "global"
    ? effectiveSelectedUserId
    : tab === "neighborhoods"
    ? (effectiveSelectedUserId || (neighborhoodLeaderboard.length > 0 ? (neighborhoodLeaderboard[0].userId || neighborhoodLeaderboard[0].id) : null))
    : effectiveSelectedUserId;

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
    queryKey: ["/api/rankings/participant-count", "month", monthKey, groupContext],
    queryFn: async () => {
      const q = new URLSearchParams({ month: monthKey });
      if (groupContext.type === "group" && groupContext.groupId) q.set("groupId", groupContext.groupId);
      const res = await fetch(`/api/rankings/participant-count?${q.toString()}`, { credentials: "include" });
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

  const headerRef = useRef<HTMLDivElement | null>(null);
  const [groupMenuTop, setGroupMenuTop] = useState<number | null>(null);

  useEffect(() => {
    if (!showGroupMenu) return;
    const update = () => {
      const el = headerRef.current;
      if (!el) return setGroupMenuTop(64);
      const rect = el.getBoundingClientRect();
      // store viewport bottom so we can position fixed relative to viewport
      setGroupMenuTop(rect.bottom);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [showGroupMenu]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div ref={headerRef} className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 py-3">
          {/* Logo - hidden when mobile menu is open */}
          <div className={`flex items-center gap-3 ${showMobileMenu ? 'sm:flex hidden' : ''}`}>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-primary">paint</span>run<span className="text-primary font-black">BCN</span>
            </span>
          </div>

          {/* Mobile: Group name indicator - shown when menu is closed */}
          {!showMobileMenu && (
            <div className="flex sm:hidden items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
              <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-primary truncate">
                {groupContext.type === "world" ? "Barcelona" : (groupInfo?.name || myGroups.find(g => g.id === groupContext.groupId)?.name || "Grupo")}
              </span>
            </div>
          )}

          {/* Mobile menu expanded content - replaces logo area */}
          {showMobileMenu && (
            <div className="flex items-center gap-2 sm:hidden flex-1">
              <Button variant="ghost" size="icon" onClick={() => {
                setShowMobileMenu(false);
                setShowMobileSearch(true);
              }} aria-label="Buscar">
                <Search className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => {
                setShowMobileMenu(false);
                setShowMobileMonth(true);
              }} aria-label="Mes">
                <Calendar className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={async () => {
                setShowMobileMenu(false);
                try { await logout(); localStorage.removeItem('contextSelector'); navigate('/login'); } catch { navigate('/login'); }
              }} aria-label="Cerrar sesión">
                <LogOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => {
                setShowMobileMenu(false);
                setShowGroupsMenuDialog(true);
              }} aria-label="Grupos">
                <Users className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Desktop controls */}
          <div className="hidden sm:flex items-center gap-3">
            <UserSearch className="w-48 lg:w-64" />
            <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
            {/* Group name indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-medium text-primary truncate max-w-[120px]">
                {groupContext.type === "world" ? "Barcelona" : (groupInfo?.name || myGroups.find(g => g.id === groupContext.groupId)?.name || "Grupo")}
              </span>
            </div>
            <Link href={`/profile/${user?.id}`}>
              <Button variant="ghost" size="icon" aria-label="Mi perfil" className="px-2">
                <Avatar className="w-7 h-7">
                  <AvatarFallback>{user?.username?.slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={async () => { try { await logout(); localStorage.removeItem('contextSelector'); navigate('/login'); } catch { navigate('/login'); } }} aria-label="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {
              const next = !showGroupMenu;
              setShowGroupMenu(next);
              if (next) {
                setShowGroupsDialog(false);
                setShowJoinDialog(false);
                setShowCreateDialog(false);
              }
            }} aria-label="Grupos">
              <Users className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile: Avatar + Hamburger menu */}
          <div className="flex items-center gap-1 sm:hidden">
            <Link href={`/profile/${user?.id}`}>
              <Button variant="ghost" size="icon" aria-label="Mi perfil" className="px-2">
                <Avatar className="w-7 h-7">
                  <AvatarFallback>{user?.username?.slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowMobileMenu(!showMobileMenu);
                setShowMobileSearch(false);
                setShowMobileMonth(false);
              }}
              aria-label="Menú"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {showGroupMenu && groupMenuTop !== null && createPortal(
          <div style={{ position: 'fixed', top: `${groupMenuTop}px`, right: '1rem', zIndex: 2147483000 }}>
            <div className="bg-card/90 backdrop-blur-md rounded-md p-2 border border-border w-56">
              <div className="flex flex-col gap-2">
                <Button variant="ghost" onClick={() => { setShowGroupMenu(false); setShowGroupsDialog(true); setShowJoinDialog(false); setShowCreateDialog(false); }}>Ver grupos</Button>
                <Button variant="ghost" onClick={() => { setShowGroupMenu(false); setShowJoinDialog(true); setShowGroupsDialog(false); setShowCreateDialog(false); }}>Entrar grupo</Button>
                <Button variant="ghost" onClick={() => { setShowGroupMenu(false); setShowCreateDialog(true); setShowGroupsDialog(false); setShowJoinDialog(false); }}>Crear grupo (Pago)</Button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showGroupsMenuDialog && (
          <Dialog open={showGroupsMenuDialog} onOpenChange={setShowGroupsMenuDialog}>
            <DialogContent className="z-[99999]">
              <DialogHeader>
                <DialogTitle>Gestionar grupos</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="justify-start" onClick={() => { setShowGroupsMenuDialog(false); setShowGroupsDialog(true); }}>Ver grupos</Button>
                <Button variant="outline" className="justify-start" onClick={() => { setShowGroupsMenuDialog(false); setShowJoinDialog(true); }}>Entrar grupo</Button>
                <Button variant="outline" className="justify-start" onClick={() => { setShowGroupsMenuDialog(false); setShowCreateDialog(true); }}>Crear grupo (Pago)</Button>
              </div>
              <DialogFooter />
            </DialogContent>
          </Dialog>
        )}

        {showMobileSearch && (
          <div className="absolute left-4 right-4 top-full mt-2 z-[99999] sm:hidden">
            <div className="bg-card/90 backdrop-blur-md rounded-md p-2 border border-border">
              <UserSearch />
            </div>
          </div>
        )}

        {showMobileMonth && (
          <div className="absolute left-4 top-full mt-2 z-[99999] sm:hidden">
            <div className="bg-card/90 backdrop-blur-md rounded-md p-2 border border-border">
              <MonthSelector monthKey={monthKey} onChange={(mk) => { setMonthKey(mk); setShowMobileMonth(false); }} />
            </div>
          </div>
        )}

        {showGroupsDialog && (
          <Dialog open={showGroupsDialog} onOpenChange={setShowGroupsDialog}>
            <DialogContent className="z-[99999]">
              <DialogHeader>
                <DialogTitle>Tus grupos</DialogTitle>
                <DialogDescription>Lista de grupos en los que estás activo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent/10">
                    <div className="min-w-0">
                      <div className="font-medium">Barcelona</div>
                      <div className="text-[12px] text-muted-foreground">Competir contra toda Barcelona</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => { setGroupContext({ type: 'world' }); localStorage.setItem('contextSelector', JSON.stringify({ type: 'world' })); setShowGroupsDialog(false); }}>Entrar</Button>
                    </div>
                  </div>

                  {myGroups.length === 0 && <div className="text-sm text-muted-foreground">No estás en ningún grupo</div>}
                  {myGroups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent/10">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{g.name}</div>
                        <div className="text-[12px] text-muted-foreground">Código: {g.invite_code}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => {
                          const shareUrl = `${window.location.origin}/login?invite=${encodeURIComponent(g.invite_code)}`;
                          const text = encodeURIComponent(`Únete a mi grupo en paintrunBCN: ${shareUrl}`);
                          window.open(`https://wa.me/?text=${text}`, '_blank');
                        }}>Invitar</Button>
                        <Button size="sm" onClick={() => { setGroupContext({ type: 'group', groupId: g.id }); localStorage.setItem('contextSelector', JSON.stringify({ type: 'group', groupId: g.id })); setShowGroupsDialog(false); }}>Entrar</Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (!confirm(`¿Seguro que quieres salir del grupo ${g.name}?`)) return;
                          try {
                            const r = await fetch('/api/groups/leave', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: g.id }) });
                            if (r.ok) {
                              const data = await r.json();
                              setMyGroups(data.groups || myGroups.filter(x => x.id !== g.id));
                              try {
                                const cs = JSON.parse(localStorage.getItem('contextSelector') || 'null');
                                if (cs && cs.type === 'group' && cs.groupId === g.id) {
                                  localStorage.removeItem('contextSelector');
                                  setGroupContext({ type: 'world' });
                                }
                              } catch (e) {}
                            } else {
                              alert('No se pudo salir del grupo');
                            }
                          } catch (e) {
                            alert('Error al salir del grupo');
                          }
                        }}>Salir</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <DialogFooter />
              </DialogContent>
            </Dialog>
          )}

          {showJoinDialog && (
            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
              <DialogContent className="z-[99999]">
                <DialogHeader>
                  <DialogTitle>Entrar en un grupo</DialogTitle>
                  <DialogDescription>Introduce el código de invitación para unirte.</DialogDescription>
                </DialogHeader>
                <GroupModal onCreated={(groupId) => { setGroupContext({ type: 'group', groupId }); localStorage.setItem('contextSelector', JSON.stringify({ type: 'group', groupId })); setShowJoinDialog(false); }} />
                <DialogFooter />
              </DialogContent>
            </Dialog>
          )}

          {showCreateDialog && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogContent className="z-[99999]">
                <DialogHeader>
                  <DialogTitle>Crear grupo</DialogTitle>
                  <DialogDescription>Escribe un nombre para tu grupo y podrás pintar el mapa de Barcelona con tus amigos. Solo hay un coste de creación; los miembros entran gratis y el grupo tiene un coste mensual de 5€.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 w-full">
                  <div>
                    <label className="block text-sm font-medium">Nombre del grupo</label>
                    <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Nombre del grupo" className="mt-2 text-white placeholder:text-gray-400" />
                  </div>

                  <p className="text-sm text-muted-foreground">Con este grupo podrás pintar áreas en equipo, invitar gente con un enlace directo y gestionar miembros. Pago único de creación + 5€/mes por grupo.</p>

                  <div className="flex gap-2">
                    <Button onClick={async () => {
                      if (!createName.trim()) { alert('Introduce un nombre para el grupo'); return; }
                      setCreating(true);
                      try {
                        // Capture current groups to detect the new group after checkout
                        let initialIds = new Set<string>();
                        try {
                          const rinit = await fetch(`/api/groups/my`, { credentials: 'include' });
                          if (rinit.ok) {
                            const d0 = await rinit.json();
                            (d0 || []).forEach((g: any) => initialIds.add(String(g.id)));
                          }
                        } catch (e) {}

                        const res = await fetch(`/api/stripe/create-checkout-session`, {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: createName.trim() }),
                        });
                        if (!res.ok) {
                          let errMsg = 'No se pudo crear la sesión';
                          try { const err = await res.json(); if (err?.message) errMsg = err.message; } catch (e) {}
                          throw new Error(errMsg);
                        }
                        const data = await res.json().catch(() => ({}));
                        const url = data?.url;
                        if (!url) {
                          // show response for debugging
                          alert('No se recibió URL de Stripe desde el servidor. Revisa los logs del servidor.');
                          console.error('Stripe session response without url:', data);
                          setCreating(false);
                          return;
                        }
                        // Try to open Stripe in a new tab. If blocked or on mobile, fall back to same-tab redirect.
                        let popup: Window | null = null;
                        try {
                          popup = window.open(url, '_blank');
                        } catch (e) {
                          popup = null;
                        }

                        // If popup didn't open or was immediately closed (common on mobile), redirect in same tab
                        const popupBlocked = !popup || (typeof popup.closed !== 'undefined' && popup.closed === true);
                        if (popupBlocked) {
                          // navigate current tab to Stripe (mobile-friendly)
                          window.location.href = url;
                          // can't poll while navigating away; rely on server webhook + return URL
                          return;
                        }

                        // Poll /api/groups/my until a new group appears (max ~90s) while popup is open
                        let attempts = 0;
                        const maxAttempts = 45;
                        const iv = setInterval(async () => {
                          attempts++;
                          try {
                            const r = await fetch(`/api/groups/my`, { credentials: 'include' });
                            if (!r.ok) return;
                            const data = await r.json();
                            const newly = (data || []).find((g: any) => !initialIds.has(String(g.id)));
                            if (newly) {
                              setGroupContext({ type: 'group', groupId: newly.id });
                              try { localStorage.setItem('contextSelector', JSON.stringify({ type: 'group', groupId: newly.id })); } catch (e) {}
                              try { popup?.close(); } catch (e) {}
                              clearInterval(iv);
                              setShowCreateDialog(false);
                              setCreateName('');
                              return;
                            }
                          } catch (e) {}
                          if (attempts >= maxAttempts) {
                            clearInterval(iv);
                          }
                        }, 2000);
                      } catch (e) {
                        alert('Error creando sesión de pago.');
                      } finally { setCreating(false); }
                    }} disabled={creating}>{creating ? 'Redirigiendo…' : 'Pagar y crear grupo'}</Button>
                    <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                  </div>
                </div>
                <DialogFooter />
              </DialogContent>
            </Dialog>
          )}
      </header>

      {/* Welcome Banner */}
      {welcomeBanner.show && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3 rounded-lg shadow-lg border border-primary/30 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {welcomeBanner.isFirstTime ? "¡Bienvenido al grupo " : "Ahora estás en "}
                {welcomeBanner.groupName}
                {welcomeBanner.isFirstTime ? "!" : ""}
              </p>
              {welcomeBanner.isFirstTime && (
                <p className="text-sm opacity-90">Compite con los miembros del grupo</p>
              )}
            </div>
            <button
              onClick={() => setWelcomeBanner(prev => ({ ...prev, show: false }))}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
            <MapIcon className="w-4 h-4" /> Por Barrios
          </Button>
          {participantCount && (
            <Badge variant="secondary" className="gap-1 ml-auto" data-testid="badge-participant-count">
              <Users className="w-3 h-3" />
              {participantCount.count} participante{participantCount.count !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] overflow-hidden">
        <aside className={`lg:w-96 border-b lg:border-b-0 lg:border-r bg-card/50 p-4 overflow-y-auto shrink-0 transition-all duration-300 ${getMobilePanelClasses(panelMode).aside}`}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tab === "global-live" ? (
            <GlobalLiveRankingList
                rankings={liveRankingsByPoints}
                points={livePoints}
                colorOverrides={colorOverrides}
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

        <MobilePanelToggle mode={panelMode} onToggle={setPanelMode} />

        <main className={`relative lg:flex-1 shrink-0 transition-all duration-300 ${getMobilePanelClasses(panelMode).main}`}>
          {tab === "global-live" ? (
            <BarcelonaMap
              className="w-full h-full"
              interactive={true}
              territories={liveTerritoriesData}
              highlightUserId={hoveredUserId || selectedUserId}
              territoryColorOverrides={colorOverrides}
              territoryMeta={territoryMeta}
              onHoverTerritory={(id) => {
                setHoveredUserId(id);
                setSelectedUserId(id);
              }}
              onLeaveTerritory={() => {
                // only clear hover state
                setHoveredUserId(null);
              }}
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
  points,
  colorOverrides,
  selectedUserId,
  onSelectUser,
}: {
  rankings: LiveRankedUser[];
  points?: LivePointsUser[];
  colorOverrides?: Record<string, string>;
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
}) {
  const pointsMap = new Map<string, number>();
  if (points) {
    for (const p of points) pointsMap.set(p.userId, p.points || 0);
  }

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
                style={{ backgroundColor: ((colorOverrides?.[u.userId]) || u.paintColor) + "30", color: (colorOverrides?.[u.userId]) || u.paintColor }}
              >
                {i === 0 ? <Crown className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
              </div>
              <Link href={`/profile/${u.userId}`}>
                <span className="text-xs font-bold truncate w-full text-center hover:underline">{u.username}</span>
              </Link>
              <span className="text-[10px] text-muted-foreground mt-0.5">{formatArea(u.territorySqMeters)}</span>
              <Badge variant="secondary" className="mt-1 text-[10px] gap-0.5">
                {Number((pointsMap.get(u.userId) || 0).toFixed(2))} pts
              </Badge>
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
              style={{ backgroundColor: ((colorOverrides?.[u.userId]) || u.paintColor) + "25" }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: (colorOverrides?.[u.userId]) || u.paintColor }}
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
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {formatArea(u.territorySqMeters)}
              </span>
              <span className="text-[11px] text-muted-foreground">{(pointsMap.get(u.userId) || 0).toFixed(2)} pts</span>
            </div>
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
        <MapIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
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
            <MapIcon className="w-4 h-4 text-primary" />
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
