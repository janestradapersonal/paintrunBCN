import { useEffect } from "react";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
}
