import {type GeoJsonArea, type GeoJsonBBox, type GeoJsonEntrypoint, type GeoJsonRouting} from "./geo.ts";
import {type Edge, type LatLon, type BoundingBox, type AreaNode, type Area} from "./models.ts";
import type {Position} from "geojson";
import {LatLng} from "leaflet";

// Recursive structure
type NestedPositions = Position | NestedPositions[];
type NestedLatLon<T> =
    T extends Position
        ? LatLon
        : T extends (infer U)[]
            ? NestedLatLon<U>[]
            : never;

export function mapCoordinates<T extends NestedPositions>(coords: T): NestedLatLon<T> {
  // Base case: Position
  if (typeof coords[0] === "number") {
    const [lng, lat] = coords as Position;
    return { lat, lon: lng } as NestedLatLon<T>;
  }

  // Recursive case: array
  return (coords as NestedPositions[]).map(c =>
      mapCoordinates(c)
  ) as NestedLatLon<T>;
}

export function mapBBox(bbox: GeoJsonBBox): BoundingBox {
  // tuple destructuring
  const [minLon, minLat, maxLon, maxLat] = bbox;

  return {
    min: { lat: minLat, lon: minLon },
    max: { lat: maxLat, lon: maxLon }
  };
}

export function mapGeoJsonRoutingEdge(feature: GeoJsonRouting): Edge {
  const coordinates: LatLon[] = feature.geometry.coordinates.map(
    ([lng, lat]) => ({ lat, lon: lng })
  );

  return {
    osmid: feature.properties.osmid,
    edge_id: feature.properties.edge_id,
    u: feature.properties.u,
    v: feature.properties.v,
    name: feature.properties.name,
    
    deadend: feature.properties.deadend,
    ride_count: feature.properties.ride_count,
    area_id: feature.properties.area_id,

    highway: feature.properties.highway,
    length: feature.properties.length,
    offroad: feature.properties.offroad,
    access: feature.properties.access,

    coordinates,
    cartesian: [],
    bbox: mapBBox(feature.properties.bbox)
  };
}

export function mapGeoAreaNode(feature: GeoJsonEntrypoint): AreaNode{
  return {
    osmid: Number(feature.properties.osmid),
    area_id: feature.properties.area_id,
    position: {lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1]}
  }
}

export function mapGeoArea(feature: GeoJsonArea): Area{
  return{
    areaId: feature.properties.area_id,
    totalLength: feature.properties.total_length,
    edgeCount: feature.properties.edge_count,
    geoData: feature,
    //coordinates: mapCoordinates(feature.geometry.coordinates),
    bbox: mapBBox(feature.properties.bbox),
    nodes: []
  }
}