import type { GeometryCollection, Topology } from "topojson-specification";
import type { LonLat } from "./orthographic";

let cache: Promise<LonLat[][]> | null = null;

/**
 * Earth's coastlines as [lon, lat] polylines, for the A3 locator. Loaded on
 * first use: the Space view chunk bundles the same 55 KB file, so Vite
 * shares it and the main bundle stays small. On failure the locator simply
 * draws no coastlines (and the next open tries again).
 */
export function loadLandLines(): Promise<LonLat[][]> {
  cache ??= Promise.all([import("topojson-client"), import("world-atlas/land-110m.json")])
    .then(([{ mesh }, land]) => {
      const topology = land.default as unknown as Topology<{ land: GeometryCollection }>;
      return mesh(topology, topology.objects.land).coordinates as unknown as LonLat[][];
    })
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}
