import type { Cartesian, LatLon } from "./models";

const R = 6371000; // meters

export function latlonToCartesian(llPoint:LatLon, projCenter:LatLon): Cartesian {
  const φ = llPoint.lat * Math.PI / 180;
  const λ = llPoint.lon * Math.PI / 180;
  const φ0 = projCenter.lat * Math.PI / 180;
  const λ0 = projCenter.lon * Math.PI / 180;

  const x = R * (λ - λ0) * Math.cos(φ0);
  const y = R * (φ - φ0);

  return { x, y };
}

