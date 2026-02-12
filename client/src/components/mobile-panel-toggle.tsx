import { ChevronDown, ChevronUp, Map, List } from "lucide-react";

export type PanelMode = "list" | "map";

interface MobilePanelToggleProps {
  mode: PanelMode;
  onToggle: (mode: PanelMode) => void;
}

export function MobilePanelToggle({ mode, onToggle }: MobilePanelToggleProps) {
  return (
    <div className="lg:hidden flex items-center justify-center shrink-0">
      <button
        onClick={() => onToggle(mode === "list" ? "map" : "list")}
        className="w-full flex items-center justify-center gap-2 py-1.5 bg-card/80 border-y border-border text-muted-foreground text-xs font-medium"
        data-testid="button-panel-toggle"
      >
        {mode === "list" ? (
          <>
            <Map className="w-3.5 h-3.5" />
            Ver mapa
            <ChevronDown className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            <List className="w-3.5 h-3.5" />
            Ver lista
            <ChevronUp className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </div>
  );
}

export function getMobilePanelClasses(mode: PanelMode) {
  return {
    aside: mode === "list"
      ? "max-h-[65vh] lg:max-h-none"
      : "max-h-[25vh] lg:max-h-none",
    main: mode === "list"
      ? "h-[25vh] lg:h-auto"
      : "h-[65vh] lg:h-auto",
  };
}
