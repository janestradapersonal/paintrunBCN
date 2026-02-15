import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ContextSelector({
  value,
  onChange,
}: {
  value: { type: "world" | "group"; groupId?: string };
  onChange: (v: { type: "world" | "group"; groupId?: string }) => void;
}) {
  const [groups, setGroups] = useState<{ id: string; name: string; invite_code: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/groups/my`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (mounted) setGroups(data || []); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium">Contexto</div>
      <select
        className="input px-2 py-1 rounded"
        value={value.type === "world" ? "world" : value.groupId || "group"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "world") onChange({ type: "world" });
          else if (v === "create") window.location.href = "/groups";
          else {
            const g = groups.find((gg) => gg.id === v);
            onChange({ type: "group", groupId: g?.id });
          }
        }}
      >
        <option value="world">Mundo</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
        <option value="create">Crear grupo...</option>
      </select>
    </div>
  );
}
