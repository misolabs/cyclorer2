import type {GeoJsonArea} from "./geo.ts";

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
  area_id?: number

  coordinates: LatLon[];
  cartesian: Cartesian[]
  
  length: number;
  bbox: BoundingBox

  highway?: string|string[];
  name?: string|string[];
  offroad: boolean
}

export interface Node{
  osmid: number
  position: LatLon
}

export interface AreaNode extends Node{
  area_id: number
  osmid: number
  position: LatLon
}

export type AreaId = number
export interface Area{
  areaId: AreaId

  geoData: GeoJsonArea
  totalLength: number
  edgeCount: number
  bbox: BoundingBox

  nodes: AreaNode[]
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
  inTravelDirection?: boolean
}

export const NavigationMode = {
  TM_NONE: 0,
  TM_EXPLORE: 1,
  TM_AREA: 2,
}
export type NavigationMode = typeof NavigationMode[keyof typeof NavigationMode];

export interface POI{
  pos: LatLon
  type: string
}

//------------
// ANNOTATIONS
//------------

// Locations = Marker
export type LocationAnnotationCategory = string
export interface LocationAnnotation{
  category: LocationAnnotationCategory
  location: LatLon
  timestamp: string
  id?: number
  text?: string
}

export interface LocationAnnotationJson{
  category: LocationAnnotationCategory
  lat: number
  lon: number
  timestamp: string
  id?: number
  text?: string
}

// Edges

export const EdgeAnnotationCategory = {
  EA_KEEPOUT: "KEEPOUT",
  EA_FAVORITE: "FAVORITES",
  EA_STEEP: "STEEPCLIMB",
  EA_FLOWTRAIL: "FLOWTRAIL",
} as const;

export interface EdgeAnnotation{
  id: number
  edge_id: string
  timestamp: string
  category: string
  comment?: string
}

export interface EdgeAnnotationRequest{
  edge_id: string
  timestamp: string
  category: string
  comment?: string
}

export interface EdgeAnnotationCreateEvent {
  edge_id: string
  category: string
  comment?: string
}