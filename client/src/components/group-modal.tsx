import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GroupModal({ onCreated }: { onCreated?: (groupId: string) => void }) {
  const [inviteCode, setInviteCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  const join = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/groups/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });
      if (!res.ok) {
        const err = await res.text();
        setJoinError(err || "Error");
      } else {
        const data = await res.json();
        onCreated?.(data.groupId);
        // Stay in-app; parent will handle navigation or UI update.
      }
    } catch (e: any) {
      setJoinError(e?.message || "Error");
    } finally { setJoining(false); }
  };

  const create = async () => {
    if (!groupName.trim()) {
      alert("Introduce un nombre para el grupo antes de crear.");
      return;
    }
    setCreating(true);
    try {
      // Capture current groups to detect the new group after checkout
      let initialIds = new Set<string>();
      try {
        const rinit = await fetch(`/api/groups/my`, { credentials: "include" });
        if (rinit.ok) {
          const d0 = await rinit.json();
          (d0 || []).forEach((g: any) => initialIds.add(String(g.id)));
        }
      } catch (e) {}

      const res = await fetch(`/api/stripe/create-checkout-session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      if (!res.ok) throw new Error("No se pudo crear la sesión");
      const { url } = await res.json();

      // Open Stripe checkout in a new tab so the app remains open
      const popup = window.open(url, '_blank');

      // Poll /api/groups/my until a new group appears (max 90s)
      let attempts = 0;
      const maxAttempts = 45;
      const iv = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch(`/api/groups/my`, { credentials: "include" });
          if (!r.ok) return;
          const data = await r.json();
          const newly = (data || []).find((g: any) => !initialIds.has(String(g.id)));
          if (newly) {
            onCreated?.(newly.id || newly.id);
            try { popup?.close(); } catch (e) {}
            clearInterval(iv);
            return;
          }
        } catch (e) {}
        if (attempts >= maxAttempts) {
          clearInterval(iv);
        }
      }, 2000);
    } catch (e) {
      alert("Error creando sesión de pago.");
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-4 w-full">
      <div>
        <Label>Unirse con código de invitación</Label>
        <div className="flex gap-2 mt-2">
          <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Código (ej: AB12CD)" className="flex-1 text-black" />
          <Button onClick={join} disabled={joining || !inviteCode.trim()}>{joining ? "Uniendo…" : "Unirse"}</Button>
        </div>
        {joinError && <p className="text-red-500 text-sm mt-1">{joinError}</p>}
      </div>

      <div className="border-t pt-4">
        <div className="mb-2">¿Quieres crear un grupo privado para tus colegas?</div>
        <div className="space-y-2">
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nombre del grupo" className="text-black" />
          <div className="flex gap-2">
            <Button onClick={create} disabled={creating || !groupName.trim()}>{creating ? "Redirigiendo…" : "Crear grupo (pago)"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
