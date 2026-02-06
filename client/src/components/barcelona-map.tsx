import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Polygon, Polyline, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { Activity } from "@shared/schema";
import "leaflet/dist/leaflet.css";

const BARCELONA_CENTER: [number, number] = [41.3874, 2.1686];
const BARCELONA_ZOOM = 13;

interface BarcelonaMapProps {
  activities?: Activity[];
  showNeighborhoods?: boolean;
  className?: string;
  interactive?: boolean;
  userColor?: string;
  intensityMode?: boolean;
  highlightNeighborhood?: string | null;
}

function MapBounds() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds([
      [41.30, 2.05],
      [41.48, 2.28],
    ]);
  }, [map]);
  return null;
}

function getIntensityOpacity(count: number): number {
  if (count <= 1) return 0.25;
  if (count === 2) return 0.4;
  if (count === 3) return 0.55;
  if (count === 4) return 0.65;
  return 0.75;
}

export default function BarcelonaMap({
  activities = [],
  showNeighborhoods = true,
  className = "",
  interactive = true,
  userColor = "#FF6B35",
  intensityMode = false,
  highlightNeighborhood = null,
}: BarcelonaMapProps) {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/barris.geojson")
      .then((res) => res.json())
      .then((data) => setGeojson(data))
      .catch(console.error);
  }, []);

  const getNeighborhoodStyle = (feature: any) => {
    const name = feature?.properties?.NOM;
    const isHighlighted = highlightNeighborhood && name === highlightNeighborhood;
    return {
      color: isHighlighted ? "#FFD700" : "hsl(197, 89%, 48%)",
      weight: isHighlighted ? 3 : 1.5,
      opacity: isHighlighted ? 0.9 : 0.6,
      fillColor: isHighlighted ? "#FFD700" : "hsl(197, 89%, 48%)",
      fillOpacity: isHighlighted ? 0.15 : 0.04,
    };
  };

  const onEachNeighborhood = (feature: any, layer: any) => {
    if (feature.properties?.NOM) {
      layer.bindTooltip(feature.properties.NOM, {
        sticky: true,
        className: "neighborhood-tooltip",
      });
    }
  };

  const polygonCounts = new Map<string, number>();
  if (intensityMode) {
    for (const activity of activities) {
      if (activity.polygon && (activity.polygon as number[][]).length > 2) {
        const key = JSON.stringify(activity.polygon);
        polygonCounts.set(key, (polygonCounts.get(key) || 0) + 1);
      }
    }
  }

  const renderedPolygonKeys = new Set<string>();

  return (
    <div className={`relative ${className}`} data-testid="map-container">
      <MapContainer
        center={BARCELONA_CENTER}
        zoom={BARCELONA_ZOOM}
        minZoom={12}
        maxZoom={18}
        className="w-full h-full rounded-md"
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        style={{ background: "hsl(0, 0%, 8%)" }}
      >
        <MapBounds />
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {showNeighborhoods && geojson && (
          <GeoJSON
            key={highlightNeighborhood || "default"}
            data={geojson}
            style={getNeighborhoodStyle}
            onEachFeature={onEachNeighborhood}
          />
        )}
        {activities.map((activity) => {
          const coords = activity.coordinates as number[][];
          if (!coords || coords.length === 0) return null;
          const latLngs: [number, number][] = coords.map((c) => [c[1], c[0]]);

          const polygonCoords = activity.polygon as number[][] | null;
          const hasPolygon = polygonCoords && polygonCoords.length > 2;

          let fillOpacity = 0.3;
          if (intensityMode && hasPolygon) {
            const key = JSON.stringify(activity.polygon);
            const count = polygonCounts.get(key) || 1;
            if (renderedPolygonKeys.has(key)) {
              fillOpacity = getIntensityOpacity(count);
            } else {
              fillOpacity = getIntensityOpacity(count);
              renderedPolygonKeys.add(key);
            }
          }

          return (
            <div key={activity.id}>
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: userColor,
                  weight: 3,
                  opacity: 0.8,
                }}
              />
              {hasPolygon && (
                <Polygon
                  positions={polygonCoords!.map((c) => [c[1], c[0]] as [number, number])}
                  pathOptions={{
                    color: userColor,
                    fillColor: userColor,
                    fillOpacity,
                    weight: 2,
                    opacity: 0.7,
                  }}
                />
              )}
            </div>
          );
        })}
      </MapContainer>
      {intensityMode && activities.some(a => a.polygon) && (
        <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm rounded-md p-3 text-xs z-[1000]">
          <p className="font-semibold mb-1.5 text-foreground">Intensidad</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="w-4 h-4 rounded-sm"
                  style={{
                    backgroundColor: userColor,
                    opacity: getIntensityOpacity(n),
                  }}
                />
              ))}
            </div>
            <span className="text-muted-foreground">1x - 4x+</span>
          </div>
        </div>
      )}
    </div>
  );
}
