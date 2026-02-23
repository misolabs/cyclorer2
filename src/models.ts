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
  cartesian?: Cartesian[]
  
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
  node: number
  distance: number
  edge: Edge
}