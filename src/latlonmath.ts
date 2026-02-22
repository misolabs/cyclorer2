import type { LatLon } from "./models";

function toRad(deg: number): number {
  return deg * Math.PI / 180;
};

export function approximateDistance(ll1: LatLon, ll2: LatLon) {
    const dLat = ll2.lat - ll1.lat;
    const dLon = (ll2.lon - ll1.lon) * Math.cos(ll1.lat * Math.PI / 180);
    return dLat*dLat + dLon*dLon;
}

export function haversineDistance(ll1: LatLon, ll2: LatLon){
    const R = 6371000.0

    const phi1 = toRad(ll1.lat)
    const phi2 = toRad(ll2.lat)
    const dphi = toRad(ll2.lat - ll1.lat)
    const dlambda = toRad(ll2.lon - ll1.lon)
    
    const a = Math.min(1, Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)* Math.sin(dlambda/2)**2)

    return 2*R*Math.asin(Math.sqrt(a))
}
