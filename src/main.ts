import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type { AreaProperties, GeoJsonArea, GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection, GeoJsonRouting, GeoJsonRoutingollection, RoutingEdgeProperties, StatsJson } from './geo'
import { EdgeGrid } from './gridindex'
import type { BoundingBox, Edge, Cartesian } from './models'
import { mapGeoJsonRoutingEdge, mapBBox } from './mapping'
import { CartesianProjection, logError } from './helpers'
import { TrackingMap } from './maps/trackingmap'
import {AreaFinder} from "./areafinder.ts";

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson

var routingGeoData: GeoJsonRoutingollection
var routingEdges: Edge[] = []

var regionBBox: BoundingBox
var edgeGridIndex: EdgeGrid
var areaFinder: AreaFinder

const trackingMap: TrackingMap = new TrackingMap("map")
trackingMap.initBaseLayer(ellergronnGPS, 13)
trackingMap.addPositionMarker(ellergronnGPS)

async function loadStats(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    statsData = await response.json();
    
    // bbox format: minLon, minLat, maxLon, maxLat
    regionBBox = mapBBox(statsData.bbox)

    //uiUpdateStats(statsData["total_length"], statsData["areas"])
    //document.getElementById("stats-total-length").classList.add("fadein-slow")
    //document.getElementById("stats-areas-count").classList.add("fadein-slow")
  } catch (err) {
    console.error("Failed to load Stats json:", err);
  }
}

async function loadRoutingEdges(url: string) {
  try {
    // Fetch area network data
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    routingGeoData = await response.json();
    console.log("Routing edges", routingGeoData.features.length)

    // Create grid
    edgeGridIndex  = new EdgeGrid(regionBBox)

    // Add edges to grid index
    for(const geoEdge of routingGeoData.features){
      // Map to domain
      const edge:Edge = mapGeoJsonRoutingEdge(geoEdge)

      // Precompute cartesian coordinates
      const center = {
        lat: (regionBBox.min.lat + regionBBox.max.lat)/ 2,
        lon: (regionBBox.min.lon + regionBBox.max.lon)/ 2}
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
      edgeGridIndex.addFeature(edge)
      // Add to adjacency graph
      // todo
    }

    // Draw edges on map
    trackingMap.addRoutingLayer(routingGeoData)
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
  areaFinder = new AreaFinder(regionBBox)
  await areaFinder.init()

  // Add a layer to the tracking map
  trackingMap.addAreaLayer(areaFinder.areaData, areaFinder.entrypointsData)

  console.log("All data loaded")
}

//  Load all application data
await loadData()
