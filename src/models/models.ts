export interface LatLon {
  lat: number;
  lon: number;
}

export interface CellIndex{
  x: number
  y: number
}

export interface Cartesian {
  x: number
  y: number
}

export interface BoundingBox {
  min: LatLon;
  max: LatLon;
}

export interface Edge {
  osmid: string|string[]
  u: number
  v: number

  deadend: boolean
  ride_count: number

  coordinates: LatLon[];
  cartesian: Cartesian[]
  
  length: number;
  bbox: BoundingBox

  highway?: string|string[];
  name?: string|string[];
}

export interface Node{
  osmid: number
  position: LatLon
}

export interface AreaNode extends Node{
  area_id: number
}

export interface AdjacencyInfo {
  node: NodeId
  distance: number
  edge: Edge
}

export interface SegmentDistance{
  distance: number
  t: number
}

export interface EdgeIntersection{
  edge: Edge
  distance: number
  segmentIndex: number
  t: number
}

export const TravelDirection = {
  U_TO_V: 0,
  V_TO_U: 1,
} as const;

export type TravelDirection = typeof TravelDirection[keyof typeof TravelDirection];

export type NodeId = number & { readonly __brand: unique symbol };

export function NodeId(value: number): NodeId {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error("Invalid NodeId");

  return value as NodeId;
}

export interface Route{
  totalLength: number
  routeEdges: Edge[]
}