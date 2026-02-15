import { useEffect, useState } from "react";
import GroupModal from "@/components/group-modal";
import { Button } from "@/components/ui/button";

export default function GroupsPage() {
  const [groups, setGroups] = useState<{ id: string; name: string; invite_code: string }[]>([]);

  useEffect(() => {
    fetch(`/api/groups/my`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setGroups(data || []))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-4">Grupos</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Unirse a un grupo</h3>
          <GroupModal onCreated={(id) => { /* redirect handled by modal */ }} />
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-2">Mis grupos</h3>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No perteneces a ningún grupo todavía.</p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">Código: {g.invite_code}</div>
                  </div>
                  <div>
                    <Button variant="ghost" size="sm" onClick={() => { localStorage.setItem('contextSelector', JSON.stringify({ type: 'group', groupId: g.id })); window.location.href = '/rankings'; }}>Seleccionar</Button>
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
