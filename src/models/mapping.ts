import {type GeoJsonArea, type GeoJsonBBox, type GeoJsonEntrypoint, type GeoJsonRouting} from "./geo.ts";
import {type Edge, type LatLon, type BoundingBox, type AreaNode} from "./models.ts";


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
    u: feature.properties.u,
    v: feature.properties.v,
    name: feature.properties.name,
    
    deadend: feature.properties.deadend,
    ride_count: feature.properties.ride_count,

    highway: feature.properties.highway,
    length: feature.properties.length,

    coordinates,
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