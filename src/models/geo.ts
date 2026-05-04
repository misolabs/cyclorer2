import type { Feature, FeatureCollection, MultiLineString, Point, LineString } from 'geojson';

// Stats and config
export interface RoutingStatsJson {
    bbox: GeoJsonBBox
    areas: number
    entrypoints: number
    total_length: number
    ride_count_max: number
}

// Bounding box in GeoJSON
export type GeoJsonBBox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

export interface  AreaProperties{
    area_id: number;

    length?: number;
    total_length: number
    bbox: GeoJsonBBox

    edge_count: number;
}


// Routing edge properties we care about
export interface RoutingEdgeProperties {
    // u,v, deadend, highway, osmid, ride_count
    osmid: string|string[]
    u: number;
    v: number;
    name?: string|string[]
    edge_id: string

    deadend: boolean
    access?: string | string[]
    highway: string | string[]
    offroad: boolean
    ride_count: number
    area_id?: number

    length: number;
    bbox: GeoJsonBBox
}

export interface EntrypointProperties {
    area_id: number;
    osmid: string
}

export type GeoJsonRouting = Feature<LineString, RoutingEdgeProperties>;
export type GeoJsonRoutingollection = FeatureCollection<LineString, RoutingEdgeProperties>

export type GeoJsonArea = Feature<MultiLineString, AreaProperties>;
export type GeoJsonAreaCollection = FeatureCollection<MultiLineString, AreaProperties>

export type GeoJsonEntrypoint = Feature<Point, EntrypointProperties>;
export type GeoJsonEntrypointCollection = FeatureCollection<Point, EntrypointProperties>
