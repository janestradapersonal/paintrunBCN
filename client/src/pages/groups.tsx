import { useEffect, useState } from "react";
import GroupModal from "@/components/group-modal";
import { Button } from "@/components/ui/button";

export default function GroupsPage() {
  const [groups, setGroups] = useState<{ id: string; name: string; invite_code: string }[]>([]);
  const [createdGroup, setCreatedGroup] = useState<{ id: string; name?: string; invite_code: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/groups/my`, { credentials: "include" });
        const data = res.ok ? await res.json() : [];
        if (mounted) setGroups(data || []);
      } catch (e) {}
    };
    load();

    // If we returned from Stripe checkout, Stripe appended ?session_id=... to the /groups URL.
    // Poll for the newly-created group and show a created-group panel when detected.
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        if (sessionId) {
          // Capture initial ids to detect new group
          const initial = new Set<string>();
          try {
            const r0 = await fetch(`/api/groups/my`, { credentials: "include" });
            if (r0.ok) {
              const d0 = await r0.json();
              (d0 || []).forEach((g: any) => initial.add(String(g.id)));
            }
          } catch (e) {}

          // Poll until a new group appears (max 15 attempts)
          for (let i = 0; i < 15 && mounted; i++) {
            try {
              await new Promise((res) => setTimeout(res, 1500));
              const r = await fetch(`/api/groups/my`, { credentials: "include" });
              if (!r.ok) continue;
              const data = await r.json();
              if (mounted) setGroups(data || []);
              const newly = (data || []).find((g: any) => !initial.has(String(g.id)));
              if (newly) {
                setCreatedGroup(newly);
                // remove session_id param from URL
                const u = new URL(window.location.href);
                u.searchParams.delete('session_id');
                window.history.replaceState({}, '', u.toString());
                break;
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    })();

    // If there is an invite code in the URL, auto-join
    try {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get("invite");
      if (invite) {
        (async () => {
          try {
            const r = await fetch(`/api/groups/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode: invite }) });
            // If the user is not authenticated, redirect to login preserving current URL
            if (r.status === 401) {
              const returnTo = window.location.pathname + window.location.search;
              window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
              return;
            }
            if (r.ok) {
              const data = await r.json();
              // data.group contains the joined group
              if (mounted) setGroups(data.groups || []);
              // set context and go to rankings
              if (data.group && data.group.id) {
                localStorage.setItem('contextSelector', JSON.stringify({ type: 'group', groupId: data.group.id }));
                // Stay on the groups page so the user sees the group in "Ver grupos"
              }
            }
          } catch (e) {}
        })();
      }
    } catch (e) {}
    return () => { mounted = false; };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {createdGroup && (
        <div className="card p-4 mb-6 border-green-400 bg-green-50">
          <h3 className="text-lg font-semibold">Grupo {createdGroup.name || ''} creado</h3>
          <p className="text-sm text-muted-foreground mb-3">Código: <strong>{createdGroup.invite_code}</strong></p>
            <div className="flex gap-2">
            <button className="btn" onClick={() => {
              const shareUrl = `${window.location.origin}/login?invite=${encodeURIComponent(createdGroup.invite_code)}`;
              const text = encodeURIComponent(`Únete a mi grupo en paintrunBCN: ${shareUrl}`);
              window.open(`https://wa.me/?text=${text}`, '_blank');
            }}>Invitar gente</button>
            <button className="btn-ghost" onClick={() => {
              setCreatedGroup(null);
            }}>Seguir en la web</button>
          </div>
        </div>
      )}
      <h2 className="text-2xl font-bold mb-4">Grupos</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Unirse a un grupo</h3>
          <GroupModal onCreated={async (id) => {
            try {
              const r = await fetch('/api/groups/my', { credentials: 'include' });
              if (r.ok) {
                const data = await r.json();
                const g = (data || []).find((x: any) => String(x.id) === String(id));
                if (g) setCreatedGroup(g);
                setGroups(data || []);
              }
            } catch (e) {}
          }} />
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-2">Mis grupos</h3>
          {groups.filter(g => g.name && g.name.trim().length > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">No perteneces a ningún grupo todavía.</p>
          ) : (
            <ul className="space-y-2">
              {groups.filter(g => g.name && g.name.trim().length > 0).map((g) => (
                <li key={g.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">Código: {g.invite_code}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const shareUrl = `${window.location.origin}/login?invite=${encodeURIComponent(g.invite_code)}`;
                        const text = encodeURIComponent(`Únete a mi grupo en paintrunBCN: ${shareUrl}`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                      }}>Invitar</Button>
                      <Button variant="ghost" size="sm" onClick={() => { localStorage.setItem('contextSelector', JSON.stringify({ type: 'group', groupId: g.id })); window.location.href = '/rankings'; }}>Seleccionar</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
