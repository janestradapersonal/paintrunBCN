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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async (name?: string) => {
    setCreating(true);
    try {
      const res = await fetch(`/api/stripe/create-checkout-session`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name || createName }) });
      if (!res.ok) throw new Error("No se pudo crear la sesión");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      alert("Error creando sesión de pago.");
    } finally { setCreating(false); }
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
          <DropdownMenuItem onSelect={() => setShowCreateDialog(true)}>Crear grupo (Pago)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tus grupos</DialogTitle>
            <DialogDescription>Lista de grupos en los que estás activo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {/* Static Barcelona entry: competir contra toda BCN */}
            <div className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent/10">
              <div className="min-w-0">
                <div className="font-medium">Barcelona</div>
                <div className="text-[12px] text-muted-foreground">Competir contra toda Barcelona</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => { onChange({ type: "world" }); setShowListDialog(false); }}>Entrar</Button>
              </div>
            </div>

            {groups.filter(g => g.name && g.name.trim().length > 0).length === 0 && <div className="text-sm text-muted-foreground">No estás en ningún grupo</div>}
            {groups.filter(g => g.name && g.name.trim().length > 0).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent/10">
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.name}</div>
                  <div className="text-[12px] text-muted-foreground">Código: {g.invite_code}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => {
                    const shareUrl = `${window.location.origin}/groups?invite=${g.invite_code}`;
                    const text = encodeURIComponent(`Únete a mi grupo en paintrunBCN: ${shareUrl}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}>Invitar</Button>
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear grupo</DialogTitle>
            <DialogDescription>Elige un nombre para tu grupo antes de pagar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 w-full">
            <div>
              <label className="block text-sm font-medium">Nombre del grupo</label>
              <input className="input w-full text-black mt-2" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Nombre del grupo" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleCreate(createName)} disabled={creating || createName.trim().length === 0}>{creating ? 'Redirigiendo…' : 'Pagar y crear grupo'}</Button>
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
