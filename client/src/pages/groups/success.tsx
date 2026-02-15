import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function GroupSuccessPage() {
  const [loc] = useLocation();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Try to find the most-recent group for the user (webhook should have created it)
    let mounted = true;
    fetch(`/api/groups/my`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!mounted) return;
        const arr = data || [];
        if (arr.length === 0) {
          // nothing yet: redirect to /groups page
          window.location.href = "/groups";
          return;
        }
        const g = arr[0];
        setGroup(g);
        setName(g.name || "");
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const saveName = async () => {
    if (!group) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/name`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Error");
      localStorage.setItem("contextSelector", JSON.stringify({ type: "group", groupId: group.id }));
      window.location.href = "/rankings";
    } catch (e) {
      alert("No se pudo guardar el nombre del grupo");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-20 text-center">Cargando…</div>;
  if (!group) return <div className="max-w-2xl mx-auto px-4 py-20 text-center">No se encontró el grupo.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">¡Tu grupo está listo!</h2>
      <p className="text-sm text-muted-foreground mb-4">Código de invitación: <strong>{group.invite_code}</strong></p>

      {group.name ? (
        <div className="mb-4">
          <p className="mb-2">Nombre del grupo:</p>
          <div className="font-medium text-lg">{group.name}</div>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <label className="block text-sm font-medium">Pon un nombre a tu grupo</label>
          <input className="input w-full text-black" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del grupo" />
          <div className="flex gap-2">
            <button className="btn" onClick={saveName} disabled={saving || name.trim().length === 0}>{saving ? 'Guardando…' : 'Guardar y entrar al grupo'}</button>
            <button className="btn-ghost" onClick={() => { localStorage.setItem("contextSelector", JSON.stringify({ type: "group", groupId: group.id })); window.location.href = "/rankings"; }}>Entrar sin nombre</button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm">Comparte este enlace con tus amigos para que se unan:</p>
        <div className="mt-2">
          <input readOnly className="input w-full text-black" value={`${window.location.origin}/groups?invite=${group.invite_code}`} onFocus={(e) => (e.target as HTMLInputElement).select()} />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button className="btn-ghost" onClick={() => { window.location.href = "/groups"; }}>Volver a Grupos</button>
        <button className="btn" onClick={() => { localStorage.setItem("contextSelector", JSON.stringify({ type: "group", groupId: group.id })); window.location.href = "/rankings"; }}>Ir al ranking del grupo</button>
      </div>
    </div>
  );
}
