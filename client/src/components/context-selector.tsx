import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import GroupModal from "@/components/group-modal";

export default function ContextSelector({
  value,
  onChange,
}: {
  value: { type: "world" | "group"; groupId?: string };
  onChange: (v: { type: "world" | "group"; groupId?: string }) => void;
}) {
  const [groups, setGroups] = useState<{ id: string; name: string; invite_code: string }[]>([]);
  const [showListDialog, setShowListDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/groups/my`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (mounted) setGroups(data || []); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const currentName =
    value.type === "world"
      ? "BCN"
      : groups.find((g) => g.id === value.groupId)?.name || "BCN";

  const handleCreate = async () => {
    try {
      const res = await fetch(`/api/stripe/create-checkout-session`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("No se pudo crear la sesión");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      alert("Error creando sesión de pago.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium">{currentName}</div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="uppercase">COMPETICIONES</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-[99999]">
          <DropdownMenuItem onSelect={() => setShowListDialog(true)}>Ver grupos</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowJoinDialog(true)}>Entrar grupo</DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCreate}>Crear grupo (Pago)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tus grupos</DialogTitle>
            <DialogDescription>Lista de grupos en los que estás activo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {groups.length === 0 && <div className="text-sm text-muted-foreground">No estás en ningún grupo</div>}
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent/10">
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.name}</div>
                  <div className="text-[12px] text-muted-foreground">Código: {g.invite_code}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => { onChange({ type: "group", groupId: g.id }); setShowListDialog(false); }}>Entrar</Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar en un grupo</DialogTitle>
            <DialogDescription>Introduce el código de invitación para unirte.</DialogDescription>
          </DialogHeader>
          <GroupModal onCreated={(groupId) => { onChange({ type: "group", groupId }); }} />
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
