import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type {StatsJson} from './models/geo.ts'
import {type BoundingBox, type LatLon, NodeId, TravelDirection} from './models/models.ts'
import {mapBBox} from './models/mapping.ts'
import {TrackingMap} from './maps/trackingmap'
import {AreaFinder} from "./routing/areafinder.ts";
import {RoutingEngine} from "./routing/routing.ts";
import {geoToLatLon} from "./crs/latlonmath.ts";

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson

var regionBBox: BoundingBox
var routingEngine!: RoutingEngine
var areaFinder!: AreaFinder

const trackingMap: TrackingMap = new TrackingMap("map")
trackingMap.initBaseLayer(ellergronnGPS, 15)
trackingMap.addPositionMarker(ellergronnGPS, moveListener)
trackingMap.addHeadingMarker(ellergronnGPS, headingMarkerListener)

let headingLatLon: LatLon
function headingMarkerListener(e: L.DragEndEvent){
  headingLatLon = geoToLatLon(e.target.getLatLng())
}

function moveListener(e: L.DragEndEvent){
  const pos: LatLon = geoToLatLon(e.target.getLatLng())

  e.target.bindPopup(`Coordinates: <br/><b>${pos.lat}<br/>${pos.lon}</b>`)
  const areas = areaFinder.findNeighbours(pos)
  console.log(areas)
  trackingMap.setAreaMarker(areas)

  const closestEdge = routingEngine.findClosestEdge(pos)
  if(closestEdge) {
    console.log("Snapped to edge:", closestEdge)
    //trackingMap.setSnappedEdge(closestEdge.edge.coordinates)

    const edgeDirection = routingEngine.travelDirection(pos, headingLatLon, closestEdge)
    let startNode: NodeId
    if(edgeDirection == TravelDirection.U_TO_V){
      trackingMap.setSnappedEdge(closestEdge.edge.coordinates.slice(closestEdge.segmentIndex))
      startNode = NodeId(closestEdge.edge.v)
    }else{ // u
      trackingMap.setSnappedEdge(closestEdge.edge.coordinates.slice(0, closestEdge.segmentIndex))
      startNode = NodeId(closestEdge.edge.u)
    }

    if(areas.length > 0){
      console.log("Dijkstra from ", startNode, " to ", NodeId(areas[0].osmid))
      const routeNodes = routingEngine.dijkstra(startNode, NodeId(areas[0].osmid))
      console.log("Route nodes:", routeNodes)
      if(routeNodes) {
        const route = routingEngine.nodes_to_edges(routeNodes)
        if(route) trackingMap.setRoute(route)
        else trackingMap.clearRoute()
      }
    }
  }else {
    console.log("No trail close to current position")
    trackingMap.setSnappedEdge([])
  }
}

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
async function loadData(){
  // First load stats
  await loadStats("data/stats.json")

  // Routing data
  routingEngine = new RoutingEngine(regionBBox)
  await routingEngine.init()

  // Areas and entrypoints
  areaFinder = new AreaFinder(regionBBox)
  await areaFinder.init()

  // Draw edges on map
  trackingMap.addRoutingLayer(routingEngine.routingGeoData)

// Add a layer to the tracking map
  trackingMap.addAreaLayer(areaFinder.areaGeoData, areaFinder.entrypointsGeoData)

  console.log("All data loaded")
}

//  Load all application data
await loadData()

