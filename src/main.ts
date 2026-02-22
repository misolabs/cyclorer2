import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type { AreaProperties, GeoJsonArea, GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection, GeoJsonRouting, GeoJsonRoutingollection, RoutingEdgeProperties, StatsJson } from './geo'
import { EdgeGrid } from './gridindex'
import type { BoundingBox, Edge, Cartesian } from './models'
import { mapGeoJsonRoutingEdge, mapBBox } from './mapping'
import { CartesianProjection, logError } from './helpers'

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson
var areaData: GeoJsonAreaCollection
var entrypointsData: GeoJsonEntrypointCollection
var routingGeoData: GeoJsonRoutingollection
var routingEdges: Edge[] = []

var areaBBox: BoundingBox
var edgeGridIndex: EdgeGrid

const map = L.map('map').setView(ellergronnGPS, 13)

// Base map tiles from OSM
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

async function loadStats(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    statsData = await response.json();
    
    // bbox format: minLon, minLat, maxLon, maxLat
    areaBBox = mapBBox(statsData.bbox)

    //uiUpdateStats(statsData["total_length"], statsData["areas"])
    //document.getElementById("stats-total-length").classList.add("fadein-slow")
    //document.getElementById("stats-areas-count").classList.add("fadein-slow")
  } catch (err) {
    console.error("Failed to load Stats json:", err);
  }
}

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
  } catch (err:unknown) {
    logError(err, "Failed to load areas:");
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
  } catch (err: unknown) {
    logError(err, "Error loading entry points")
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

    // Create grid
    edgeGridIndex  = new EdgeGrid(areaBBox)

    // Add edges to grid index
    for(const geoEdge of routingGeoData.features){
      // Map to domain
      const edge:Edge = mapGeoJsonRoutingEdge(geoEdge)

      // Precompute cartesian coordinates
      const center = {
        lat: (areaBBox.min.lat + areaBBox.max.lat)/ 2, 
        lon: (areaBBox.min.lon + areaBBox.max.lon)/ 2}
      const projector = new CartesianProjection(center)
      const cartesian: Cartesian[] = []
      for(const p of edge.coordinates){
        const pXY = projector.fromLatlon(p)
        cartesian.push(pXY)
      }
      edge.cartesian = cartesian

      // Add to edge list
      routingEdges.push(edge)
      // Add to spatial grid index for fast lookup
      edgeGridIndex.addFeature(edge, edge.bbox)
      // Add to adjacency graph
      // todo
    }


    // Simply draw entrypoints as markers
    L.geoJSON(routingGeoData.features, {
      onEachFeature: popupRoutingEdge,
      style: {color: "grey", weight: 2}
    }).addTo(map)
  } catch (err: unknown) {
    logError(err, "Failed to load entrypoints:");
  }
}

async function loadData(){
  // First load stats
  await loadStats("data/stats.json")

  // Routing data
  await loadRoutingEdges("data/routing_edges.geojson")

  // Areas and entrypoints
  await Promise.all([
    loadAreas("data/unvisited_areas.geojson"),
    loadEntrypoints("data/unvisited_junctions.geojson")
  ])

  console.log("All data loaded")
}


// Draggable marker with coords popup
function moveListener(e: L.DragEndEvent){
  e.target.bindPopup(`Coordinates: <br/><b>${e.target.getLatLng().lat}<br/>${e.target.getLatLng().lng}</b>`)
}

const myPos = L.marker(ellergronnGPS, {draggable: true}).addTo(map)
myPos.addEventListener("dragend", moveListener)

loadData()