import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type { AreaProperties, GeoJsonArea, GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection, GeoJsonRouting, GeoJsonRoutingollection, RoutingEdgeProperties } from './geo'
import { EdgeGrid } from './gridindex'
import type { BoundingBox, Edge } from './models'
import { mapGeoJsonRoutingEdge } from './mapping'

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var areaData: GeoJsonAreaCollection
var entrypointsData: GeoJsonEntrypointCollection
var routingGeoData: GeoJsonRoutingollection

// [5.9592044, 49.44542859999999, 6.079074900000001, 49.5063042]
const areaBBox: BoundingBox = {min:{lat:49.44542859999999, lon:5.9592044}, max:{lat:49.5063042, lon:6.079074900000001}}
const edgeGridIndex: EdgeGrid = new EdgeGrid(areaBBox)

const map = L.map('map').setView(ellergronnGPS, 13)

// Base map tiles from OSM
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

async function loadAreas(url: string) {
  try {
    // Fetch area network data
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    areaData = await response.json();
    console.log("Areas", areaData.features.length)

    // Draw bounding box for each area
    const features: GeoJsonArea[] = areaData.features
    for(let i=0; i < areaData.features.length;i++){
      const [minLon, minLat, maxLon, maxLat] = features[i].properties.bbox
      const bounds = L.latLngBounds(
        [minLat, minLon],
        [maxLat, maxLon]
      );
      
      L.rectangle(bounds,{weight:1, color: (features[i].properties.total_length > 200 ? "Purple": "Blue")})
        .bindPopup(`${features[i].properties.total_length.toFixed(0)}`)
        .addTo(map)
//        .on("mouseover", (e:L.LeafletMouseEvent) => {e.target.setStyle({color: "white"})})
    }

    L.geoJSON(areaData.features,
      {
      style: {
        color: "red",
        weight: 2,
        opacity: 0.7
      }
    }).addTo(map)
  } catch (err) {
    console.error("Failed to load areas:", err.message);
  }
}

async function loadEntrypoints(url: string) {
  try {
    // Fetch area network data
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    entrypointsData = await response.json();
    console.log("Entrypoints", entrypointsData.features.length)

    // Simply draw entrypoints as markers
    L.geoJSON(entrypointsData.features,{
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {color: "red", radius: 2, opacity:1})
      }
    }).addTo(map)
  } catch (err) {
    console.error("Failed to load entrypoints:", err.message);
  }
}

function popupRoutingEdge(feature: GeoJsonRouting, layer: L.Polyline){
  const html = `<table>
  <tr>
  <td>classification</td>
  <td><b>${feature.properties.highway}</b></td>
  </tr>
  <tr>
  <td>length</td>
  <td><b>${feature.properties.length.toFixed(0)}m</b></td>
  </tr>
  </table>`
  layer.bindPopup(html)
}

async function loadRoutingEdges(url: string) {
  try {
    // Fetch area network data
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    routingGeoData = await response.json();
    console.log("Routing edges", routingGeoData.features.length)

    // Add edges to grid index
    for(const geoEdge of routingGeoData.features){
      const edge:Edge = mapGeoJsonRoutingEdge(geoEdge)
      edgeGridIndex.addFeature(edge, edge.bbox)
    }


    // Simply draw entrypoints as markers
    L.geoJSON(routingGeoData.features, {
      onEachFeature: popupRoutingEdge,
      style: {color: "grey", weight: 2}
    }).addTo(map)
  } catch (err) {
    console.error("Failed to load entrypoints:", err.message);
  }
}

loadRoutingEdges("data/routing_edges.geojson")
loadAreas("data/unvisited_areas.geojson")
loadEntrypoints("data/unvisited_junctions.geojson")

// Draggable marker with coords popup
function moveListener(e: L.DragEndEvent){
  e.target.bindPopup(`Coordinates: <br/><b>${e.target.getLatLng().lat}<br/>${e.target.getLatLng().lng}</b>`)
}

const myPos = L.marker(ellergronnGPS, {draggable: true}).addTo(map)
myPos.addEventListener("dragend", moveListener)