import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Trophy, Upload, ArrowRight } from "lucide-react";
import BarcelonaMap from "@/components/barcelona-map";
import { useAuth } from "@/lib/auth";

export default function LandingPage() {
  const { user } = useAuth();
  const [entered, setEntered] = useState(() => {
    return sessionStorage.getItem("paintrunbcn_entered") === "true";
  });

  const handleEnter = () => {
    sessionStorage.setItem("paintrunbcn_entered", "true");
    setEntered(true);
  };

  if (!entered) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="absolute inset-0">
          <BarcelonaMap
            className="w-full h-full"
            interactive={false}
            showNeighborhoods={true}
          />
          <div className="absolute inset-0 bg-background/70" />
        </div>
        <div className="relative z-10 flex items-center justify-center w-full h-full px-4">
          <div className="flex flex-col items-center text-center max-w-lg">
            <span className="text-3xl md:text-5xl font-black tracking-tight mb-4" data-testid="text-splash-logo">
              <span className="text-primary">paint</span>
              <span className="text-foreground">run</span>
              <span className="text-primary font-black">BCN</span>
            </span>
            <p className="text-muted-foreground text-sm md:text-base mb-8 leading-relaxed">
              Pinta Barcelona corriendo. Sube tus rutas, conquista barrios y compite por el mapa.
            </p>
            <Button
              size="lg"
              className="gap-2 text-base px-8"
              onClick={handleEnter}
              data-testid="button-enter-site"
            >
              Entrar <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link href="/">
            <span className="text-xl font-bold tracking-tight" data-testid="text-logo">
              <span className="text-primary">paint</span>
              <span className="text-foreground">run</span>
              <span className="text-primary font-black">BCN</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard">
                <Button data-testid="button-dashboard">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" data-testid="button-login">Entrar</Button>
                </Link>
                <Link href="/register">
                  <Button data-testid="button-register">Registrarse</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 pt-16">
          <BarcelonaMap
            className="w-full h-full"
            interactive={false}
            showNeighborhoods={true}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 py-32 md:py-48">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 mb-6 text-sm font-medium">
            <MapPin className="w-4 h-4" />
            Inspirado en Paper.io
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl leading-tight text-foreground">
            Pinta Barcelona
            <br />
            <span className="text-primary">corriendo</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Sube tus actividades de Strava, cierra circuitos por la ciudad y conquista barrios enteros.
            Compite con otros runners por pintar m&aacute;s metros cuadrados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
            <Link href={user ? "/dashboard" : "/register"}>
              <Button size="lg" className="gap-2 text-base" data-testid="button-cta">
                Empieza a pintar <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/rankings">
              <Button variant="outline" size="lg" className="gap-2 text-base" data-testid="button-rankings">
                <Trophy className="w-4 h-4" /> Ver Ranking
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Upload className="w-6 h-6" />}
            title="Sube tu GPX"
            description="Exporta tu actividad desde Strava en formato GPX y s&uacute;bela a paintrunBCN."
          />
          <FeatureCard
            icon={<MapPin className="w-6 h-6" />}
            title="Pinta el mapa"
            description="Cuando tu ruta cierra un circuito, el &aacute;rea interior se pinta de tu color."
          />
          <FeatureCard
            icon={<Trophy className="w-6 h-6" />}
            title="Compite en el ranking"
            description="Acumula metros cuadrados pintados y escala posiciones en el ranking global."
          />
        </div>
      </section>

      <footer className="border-t py-8 text-center text-muted-foreground text-sm">
        <p>paintrunBCN &mdash; Pinta Barcelona corriendo</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card border border-card-border rounded-md p-6 hover-elevate" data-testid={`card-feature-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
