import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, LogIn } from "lucide-react";
import BarcelonaMap from "@/components/barcelona-map";
import { useAuth } from "@/lib/auth";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="fixed inset-0 bg-background">
      <div className="absolute inset-0 pointer-events-none">
        <BarcelonaMap
          className="w-full h-full"
          interactive={false}
          showNeighborhoods={true}
        />
      </div>
      <div className="absolute inset-0 bg-background/60 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center w-full h-full px-4">
        <div className="flex flex-col items-center text-center max-w-md w-full bg-card/90 backdrop-blur-md border border-card-border rounded-md p-8 md:p-10">
          <span className="text-3xl md:text-5xl font-black tracking-tight mb-3" data-testid="text-splash-logo">
            <span className="text-primary">paint</span>
            <span className="text-foreground">run</span>
            <span className="text-primary font-black">BCN</span>
          </span>
          <p className="text-muted-foreground text-sm md:text-base mb-8 leading-relaxed">
            Pinta Barcelona corriendo. Sube tus rutas, conquista barrios y compite por el mapa.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 text-base w-full" data-testid="button-enter-dashboard">
                  Ir al Dashboard <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg" className="gap-2 text-base w-full" data-testid="button-enter-login">
                    Entrar <LogIn className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="lg" className="gap-2 text-base w-full" data-testid="button-enter-register">
                    Registrarse <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            )}
            <Link href="/rankings">
              <Button variant="ghost" size="lg" className="gap-2 text-base w-full" data-testid="button-enter-rankings">
                <Trophy className="w-4 h-4" /> Ver Ranking
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
