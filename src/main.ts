import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type {StatsJson} from './models/geo.ts'
import {
  type Area, type AreaNode,
  type BoundingBox,
  type Edge,
  type LatLon,
  NodeId,
  type Route,
  TravelDirection
} from './models/models.ts'
import {mapBBox} from './models/mapping.ts'
import {TrackingMap} from './maps/trackingmap'
import {AreaFinder} from "./routing/areafinder.ts";
import {RoutingEngine} from "./routing/routing.ts";
import {geoToLatLon, interpolateLatLon} from "./crs/latlonmath.ts";
import {PreviewMap} from "./maps/previewmap.ts";

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson

var regionBBox: BoundingBox
var routingEngine!: RoutingEngine
var areaFinder!: AreaFinder

const trackingMap: TrackingMap = new TrackingMap("tracking-map")
trackingMap.initBaseLayer(ellergronnGPS, 15)
trackingMap.addPositionMarker(ellergronnGPS, moveListener)
trackingMap.addHeadingMarker(ellergronnGPS, headingMarkerListener)

const previewMap: PreviewMap = new PreviewMap("preview-map")

let headingLatLon: LatLon = geoToLatLon(ellergronnGPS)
let posLatLon: LatLon = geoToLatLon(ellergronnGPS)

function headingMarkerListener(e: L.DragEndEvent){
  headingLatLon = geoToLatLon(e.target.getLatLng())
  updateRouting()
}

function moveListener(e: L.DragEndEvent) {
  posLatLon = geoToLatLon(e.target.getLatLng())

  e.target.bindPopup(`Coordinates: <br/><b>${posLatLon.lat}<br/>${posLatLon.lon}</b>`)
  updateRouting()
}

var currentEntrypoint: AreaNode|null
var currentEdge: Edge|null
var currentRoute: Route|null

function findRoute(startNode: NodeId, targetNode: NodeId, currentEdge: Edge){
  const routeNodes = routingEngine.dijkstra(startNode, targetNode)

  if(routeNodes) {
    const route = routingEngine.nodes_to_edges(routeNodes)
    if (route) {
      // Is the target ahead of us?
      route.inTravelDirection = !(route.routeEdges.length > 0 && route.routeEdges[0] === currentEdge)
      return route
    } else console.log("Could not reconstruct edges")
  }else console.log("Dijkstra found no route")

  return undefined
}

function updateRouting(){
  const closestEdge = routingEngine.findClosestEdge(posLatLon)

  if(closestEdge){
    const edgeDirection = routingEngine.travelDirection(posLatLon, headingLatLon, closestEdge)
    // Prepare for routing - Starting node and heading
    let startNode: NodeId
    let segments: LatLon[] = []
    if (edgeDirection == TravelDirection.U_TO_V) {
      segments = closestEdge.edge.coordinates.slice(closestEdge.segmentIndex)
      segments[0] = interpolateLatLon(segments[0], segments[1], closestEdge.t)
      startNode = NodeId(closestEdge.edge.v)
    } else { // u
      segments = closestEdge.edge.coordinates.slice(0, closestEdge.segmentIndex + 2).reverse()
      segments[0] = interpolateLatLon(segments[0], segments[1], 1 - closestEdge.t)
      startNode = NodeId(closestEdge.edge.u)
    }

    // 1. Unvisited territory
    if(closestEdge.edge.ride_count == 0){
      console.log("Unvisited territory")
      currentRoute = null
      // TODO Determine area we are visiting and show preview
      trackingMap.clearRoute()
    }
    else{
      // 2. If we are still on the same edge, no need to recompute everything
      if(closestEdge.edge == currentEdge && currentRoute){
        console.log("Staying on ame route")
        trackingMap.setSnappedEdge(segments)
        trackingMap.setRoute(currentRoute)
      }else {
        // 3. Find close-by areas
        const entrypointCandidates = areaFinder.findNeighbours(posLatLon)
        console.log("Found entrypoints", entrypointCandidates)
        trackingMap.setAreaMarker(entrypointCandidates)

        if (entrypointCandidates.length > 0) {
          let targetNode: AreaNode
          let foundRoute: boolean = false

          // 3.A Stay on the same target if possible
          if (currentEntrypoint != null && entrypointCandidates.find(ep => ep === currentEntrypoint)) {
            console.log("Same entrypoint, new route")
            const routeCandidate = findRoute(startNode, NodeId(currentEntrypoint.osmid), closestEdge.edge)
            if (routeCandidate && routeCandidate.inTravelDirection) {
              foundRoute = true
              currentRoute = routeCandidate
            }
          }

          // 3.B Find a new best candidate - Criterium: Area size and heading direction
          if (!foundRoute) {
            console.log("Trying to find new entrypoint to largest area")
            entrypointCandidates.sort((a, b) =>
              areaFinder.areaInfoById(a.area_id).totalLength - areaFinder.areaInfoById(b.area_id).totalLength).reverse()

            // Try candidates from largest to smallest
            for(const entrypoint of entrypointCandidates){
              const routeCandidate = findRoute(startNode, NodeId(entrypoint.osmid), closestEdge.edge)
              console.log("Checking candidate...", routeCandidate)
              if (routeCandidate && routeCandidate.inTravelDirection) {
                console.log("Found new route to new entrypoint")
                foundRoute = true
                currentRoute = routeCandidate
                currentEntrypoint = entrypoint
                break
              }
            }
          }

          // We have a valid new route
          if(foundRoute && currentRoute){
            trackingMap.setSnappedEdge(segments)
            trackingMap.setRoute(currentRoute)
            if(currentEntrypoint)
              previewMap.setArea(areaFinder.areaInfoById(currentEntrypoint.area_id))
          }
        } else {
          // We have no target
          currentEntrypoint = null
          currentRoute = null
          trackingMap.clearRoute()
        }
      }
    }
  }else{
    // We are completely lost -> hide everything
    trackingMap.clearRoute()
    previewMap.clearArea()
    trackingMap.clearAreaMarker()

    console.log("No trail close to current position")
  }
}

async function loadConfig(url: string) {
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
  await loadConfig("data/stats.json")

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

