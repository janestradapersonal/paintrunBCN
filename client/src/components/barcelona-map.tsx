import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Polygon, Polyline, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { Activity } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BARCELONA_CENTER: [number, number] = [41.3874, 2.1686];
const BARCELONA_ZOOM = 13;

interface BarcelonaMapProps {
  activities?: Activity[];
  highlightedUserId?: string;
  showNeighborhoods?: boolean;
  className?: string;
  interactive?: boolean;
  userColor?: string;
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

export default function BarcelonaMap({
  activities = [],
  showNeighborhoods = true,
  className = "",
  interactive = true,
  userColor = "#FF6B35",
}: BarcelonaMapProps) {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/barris.geojson")
      .then((res) => res.json())
      .then((data) => setGeojson(data))
      .catch(console.error);
  }, []);

  const neighborhoodStyle = {
    color: "hsl(197, 89%, 48%)",
    weight: 1.5,
    opacity: 0.6,
    fillColor: "hsl(197, 89%, 48%)",
    fillOpacity: 0.04,
  };

  const onEachNeighborhood = (feature: any, layer: any) => {
    if (feature.properties?.NOM) {
      layer.bindTooltip(feature.properties.NOM, {
        sticky: true,
        className: "neighborhood-tooltip",
      });
    }
  };

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
            data={geojson}
            style={neighborhoodStyle}
            onEachFeature={onEachNeighborhood}
          />
        )}
        {activities.map((activity) => {
          const coords = activity.coordinates as number[][];
          if (!coords || coords.length === 0) return null;
          const latLngs: [number, number][] = coords.map((c) => [c[1], c[0]]);
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
              {activity.polygon && (activity.polygon as number[][]).length > 2 && (
                <Polygon
                  positions={(activity.polygon as number[][]).map((c) => [c[1], c[0]] as [number, number])}
                  pathOptions={{
                    color: userColor,
                    fillColor: userColor,
                    fillOpacity: 0.3,
                    weight: 2,
                    opacity: 0.7,
                  }}
                />
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
