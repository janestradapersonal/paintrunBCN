import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GroupModal({ onCreated }: { onCreated?: (groupId: string) => void }) {
  const [inviteCode, setInviteCode] = useState("");
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
        window.location.href = `/groups/success?groupId=${encodeURIComponent(data.groupId)}`;
      }
    } catch (e: any) {
      setJoinError(e?.message || "Error");
    } finally { setJoining(false); }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/stripe/create-checkout-session`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudo crear la sesión");
      const { url } = await res.json();
      window.location.href = url;
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
        <Button onClick={create} disabled={creating}>{creating ? "Redirigiendo…" : "Crear grupo (pago)"}</Button>
      </div>
    </div>
  );
}
