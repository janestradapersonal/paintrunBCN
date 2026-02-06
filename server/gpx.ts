import { XMLParser } from "fast-xml-parser";
import * as turf from "@turf/turf";

export function parseGPX(xmlContent: string): {
  name: string;
  coordinates: number[][];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const gpx = parser.parse(xmlContent);

  let name = "Actividad sin nombre";
  if (gpx?.gpx?.metadata?.name) {
    name = gpx.gpx.metadata.name;
  } else if (gpx?.gpx?.trk?.name) {
    name = gpx.gpx.trk.name;
  }

  const coordinates: number[][] = [];

  const trk = gpx?.gpx?.trk;
  if (trk) {
    const tracks = Array.isArray(trk) ? trk : [trk];
    for (const track of tracks) {
      const trksegs = track.trkseg;
      if (!trksegs) continue;
      const segments = Array.isArray(trksegs) ? trksegs : [trksegs];
      for (const seg of segments) {
        const points = seg.trkpt;
        if (!points) continue;
        const pts = Array.isArray(points) ? points : [points];
        for (const pt of pts) {
          const lon = parseFloat(pt["@_lon"]);
          const lat = parseFloat(pt["@_lat"]);
          if (!isNaN(lon) && !isNaN(lat)) {
            coordinates.push([lon, lat]);
          }
        }
      }
    }
  }

  const rte = gpx?.gpx?.rte;
  if (rte && coordinates.length === 0) {
    const routes = Array.isArray(rte) ? rte : [rte];
    for (const route of routes) {
      if (route.name && name === "Actividad sin nombre") {
        name = route.name;
      }
      const pts = route.rtept;
      if (!pts) continue;
      const points = Array.isArray(pts) ? pts : [pts];
      for (const pt of points) {
        const lon = parseFloat(pt["@_lon"]);
        const lat = parseFloat(pt["@_lat"]);
        if (!isNaN(lon) && !isNaN(lat)) {
          coordinates.push([lon, lat]);
        }
      }
    }
  }

  return { name, coordinates };
}

export function calculateDistance(coordinates: number[][]): number {
  if (coordinates.length < 2) return 0;
  const line = turf.lineString(coordinates);
  return turf.length(line, { units: "meters" });
}

export function detectClosedLoop(coordinates: number[][]): number[][] | null {
  if (coordinates.length < 10) return null;

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  const distStartEnd = turf.distance(
    turf.point(start),
    turf.point(end),
    { units: "meters" }
  );

  if (distStartEnd > 500) return null;

  const closedCoords = [...coordinates, coordinates[0]];

  try {
    const polygon = turf.polygon([closedCoords]);
    const simplified = turf.simplify(polygon, { tolerance: 0.0001, highQuality: true });
    const coords = simplified.geometry.coordinates[0];
    if (coords.length < 4) return null;
    return coords;
  } catch {
    return null;
  }
}

export function calculateArea(polygon: number[][]): number {
  if (!polygon || polygon.length < 4) return 0;
  try {
    const poly = turf.polygon([polygon]);
    return turf.area(poly);
  } catch {
    return 0;
  }
}
