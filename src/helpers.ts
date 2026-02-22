import type { Cartesian, LatLon } from "./models";

export class CartesianProjection{
  static R = 6371000; // meters
  projCenter: LatLon

  constructor(projCenter:LatLon){
    this.projCenter = projCenter
  }

  fromLatlon(llPoint:LatLon): Cartesian {
    const φ = llPoint.lat * Math.PI / 180;
    const λ = llPoint.lon * Math.PI / 180;
    const φ0 = this.projCenter.lat * Math.PI / 180;
    const λ0 = this.projCenter.lon * Math.PI / 180;

    const x = CartesianProjection.R * (λ - λ0) * Math.cos(φ0);
    const y = CartesianProjection.R * (φ - φ0);

    return { x, y };
  }
}

export function logError(e: unknown, ...args:any): string {
  if (e instanceof Error){
    console.error(...args, e.message); 
    return e.message;
  }
  console.error(...args, String(e))
  return String(e);
}