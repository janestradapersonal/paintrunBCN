import { useEffect } from "react";
import { useLocation } from "wouter";

export default function GroupSuccessPage() {
  const [loc] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gid = params.get("groupId");
    if (gid) {
      localStorage.setItem("contextSelector", JSON.stringify({ type: "group", groupId: gid }));
      // navigate to rankings (use location replace)
      window.location.href = "/rankings";
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <h2 className="text-2xl font-bold mb-4">¡Grupo creado!</h2>
      <p className="text-muted-foreground">Redirigiendo al ranking del grupo...</p>
    </div>
  );
}
