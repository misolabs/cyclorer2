import 'bootstrap/dist/css/bootstrap.min.css'
import './css/map.css'
import './css/settings.css'
import './css/splash.css'

import L, { loadLegacyPlugins } from './leaflet-legacy'
await loadLegacyPlugins()

import type {StatsJson} from './models/geo.ts'
import {
  type AreaNode,
  type BoundingBox, type Cartesian,
  type Edge, type EdgeIntersection,
  type LatLon, NavigationMode,
  NodeId,
  type Route,
  TravelDirection
} from './models/models.ts'
import {mapBBox} from './models/mapping.ts'
import {TrackingMap} from './maps/trackingmap'
import {AreaFinder} from "./routing/areafinder.ts"
import {RoutingEngine} from "./routing/routing.ts";
import {bbCenter, geoToLatLon, haversineDistance, interpolateLatLon} from "./crs/latlonmath.ts";
import {PreviewMap} from "./maps/previewmap.ts";
import {formatDistance, setDebug, setDescription, setDirections} from "./dom.ts";
import {HeadingExp} from "./routing/heading.ts";
import {CartesianProjection} from "./helpers.ts";
import {type Settings, settingsInit, settingsShow} from "./views/settings.ts";
import {accDistances, interpolateCartesian} from "./crs/cartesian.ts";
import "./views/splash.ts"
import {splashSetStats} from "./views/splash.ts";

import { registerSW } from "virtual:pwa-register"
import {initAreaView} from "./views/arealist.ts";
import {LatLng} from "leaflet";

registerSW({
  immediate: true
})

const isMobileLike = window.matchMedia("(pointer: coarse)").matches;
//const isMobileLike = true

const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson

var regionBBox: BoundingBox
var routingEngine!: RoutingEngine
export var areaFinder!: AreaFinder
export var projection: CartesianProjection

const trackingMap: TrackingMap = new TrackingMap("tracking-map", isMobileLike)
// TODO - Integrate zoom level into settings
trackingMap.map.setView(ellergronnGPS, 16)

trackingMap.addPositionMarker(ellergronnGPS, (isMobileLike ? null : positionMarkerListener))
if(!isMobileLike) {
  trackingMap.addHeadingMarker(ellergronnGPS, headingMarkerListener)
  setInterval(simulationListener, 2000)
}

const previewMap: PreviewMap = new PreviewMap("preview-map")

let headingLatLon: LatLon = geoToLatLon(ellergronnGPS)
let posLatLon: LatLon = geoToLatLon(ellergronnGPS)
let lastPosLatLon: LatLon = geoToLatLon(ellergronnGPS)

var viewFollowTracking = true
var watchId: number = -1
var trackingEnabled = isMobileLike // Enable on mobile
var exploring = false
var score = 0
const scoreEl = document.getElementById("score")!

function headingMarkerListener(e: L.DragEndEvent){
  headingLatLon = geoToLatLon(e.target.getLatLng())
}

function positionMarkerListener(e: L.DragEndEvent) {
  posLatLon = geoToLatLon(e.target.getLatLng())
}

function simulationListener(){
  // Project positions for bearing calculations
  const posXY = projection.fromLatlon(posLatLon)
  const headingXY = projection.fromLatlon(headingLatLon)

  //console.log("posXY", posXY)

  // Set bearing
  heading.reinit(posXY, headingXY, 2.0)
  //console.log(posXY, headingXY)
  trackingMap.map.setBearing(heading.getBearing())

  // Update routing
  updateRouting2()
  keepScore()
}

// Hide UI when we ride
// Elements to toggle are marked with a css class
var isUIOverlayVisible = true
function toggleUIOverlays(speed: number) {
  const overlayElements = document.querySelectorAll(".ui-overlay-element")
  // Slowing down -> show
  if(speed < 0.5 && !isUIOverlayVisible) {
    overlayElements.forEach(overlayElement => {
      overlayElement.classList.remove("hide")
    })
    // TODO: Hide zoom control on map
    isUIOverlayVisible = true
  // Speeding up -> hide
  }else if(speed > 1.0 && isUIOverlayVisible) {
    for(const el of overlayElements) {
      if (!el.classList.contains("hide")) {
        el.classList.add("hide")
      }
    }
    isUIOverlayVisible = false
  }
}

function trackingListener(pos: GeolocationPosition){
  if(currentSettings.toggleOverlaysWhenRiding && pos.coords.speed)
    toggleUIOverlays(pos.coords.speed)

  posLatLon = {lat: pos.coords.latitude, lon: pos.coords.longitude}
  trackingMap.setPosition(posLatLon, viewFollowTracking)

  const posXY = projection.fromLatlon(posLatLon)
  heading.update(posXY, pos.coords.speed)
  const smoothBearing = Math.round(heading.getBearing() / 5 ) * 5

  if(viewFollowTracking)
    trackingMap.map.setBearing(smoothBearing)

  //setDebug(`Angle: ${heading.getBearing()} \n Dir: (${heading.getDirection()?.x}, ${heading.getDirection()?.y})`)
  updateRouting2()

  keepScore()
}

var scoreTimerId = -1
function keepScore(){
  console.log(currentEdge?.area_id)

  // Update score
  if(exploring) {
    if (currentEdge && currentEdge.area_id != undefined){
      // Add distance to score
      score += haversineDistance(posLatLon, lastPosLatLon)
      scoreEl.textContent = `${score.toFixed(0)}m`
      trackingMap.extendSnailTrail(new LatLng(posLatLon.lat, posLatLon.lon))
    }else{
      // We just re-entered known routes
      exploring = false
      scoreTimerId = setTimeout(() => {
        scoreEl.classList.remove("counting")
        scoreTimerId = -1
      }, 5000)
    }
  }else{
    // We just enetered unknown territory
    if (currentEdge && currentEdge.area_id != undefined) {
      if(scoreTimerId != -1){
        clearTimeout(scoreTimerId)
        scoreTimerId = -1
      }

      exploring = true
      scoreEl.classList.add("counting")
      trackingMap.startSnailTrail(new LatLng(posLatLon.lat, posLatLon.lon))
    }
  }
  lastPosLatLon = posLatLon
}

function registerTrackingListener(){
  watchId = navigator.geolocation.watchPosition(
      trackingListener,
      (err) => console.warn("Geolocation error:", err.message),
      { enableHighAccuracy: true }
  );
}

var navigationMode: NavigationMode = NavigationMode.TM_NONE
var currentTarget: AreaNode|null
var currentEdge: Edge|null
var currentRoute: Route|null
var heading: HeadingExp = new HeadingExp()
var entrypointCandidates: AreaNode[] = []
var forceRecalculation = false

// Keep for now for reference
function updateRouting(){
  const closestEdge = routingEngine.findClosestEdge(posLatLon)

  if(closestEdge){
//    const edgeDirection = routingEngine.travelDirection(posLatLon, headingLatLon, closestEdge)
    const edgeDirection = routingEngine.travelDirectionVector(heading.getDirection(), closestEdge)

    // Prepare for routing - Starting node and heading
    let startNode: NodeId
    let segments: LatLon[]
    let splitXY: Cartesian[]
    if (edgeDirection == TravelDirection.U_TO_V) {
      // Split current edge for drawing
      segments = closestEdge.edge.coordinates.slice(closestEdge.segmentIndex)
      segments[0] = interpolateLatLon(segments[0], segments[1], closestEdge.t)
      // Split projection for distance
      splitXY = closestEdge.edge.cartesian.slice(closestEdge.segmentIndex)
      splitXY[0] = interpolateCartesian(splitXY[0], splitXY[1], closestEdge.t)
      startNode = NodeId(closestEdge.edge.v)
    } else { // u
      // Split current edge for drawing
      segments = closestEdge.edge.coordinates.slice(0, closestEdge.segmentIndex + 2).reverse()
      segments[0] = interpolateLatLon(segments[0], segments[1], 1 - closestEdge.t)
      // Split projection for distance
      splitXY = closestEdge.edge.cartesian.slice(0, closestEdge.segmentIndex + 2)
      splitXY[0] = interpolateCartesian(splitXY[0], splitXY[1], 1 - closestEdge.t)
      startNode = NodeId(closestEdge.edge.u)
    }

    // 1. Unvisited territory
    if(closestEdge.edge.ride_count == 0 && closestEdge.edge.area_id != undefined){
      setDirections("GO Explore!")
      const area = areaFinder.areaInfoById(closestEdge.edge.area_id)
      setDescription(formatDistance(area.totalLength))
      previewMap.setArea(area)

      currentRoute = null
      trackingMap.clearRoute()
    }
    else{
      // 2. If we are still on the same edge, no need to recompute everything
      if(closestEdge.edge == currentEdge && currentRoute && !forceRecalculation){
        console.log("Staying on same route")
        trackingMap.setSnappedEdge(segments)
        trackingMap.setRoute(currentRoute)
        const totalDistance = accDistances(splitXY) + currentRoute.totalLength
        setDirections(formatDistance(totalDistance))
      }else {
        // 3. Find close-by areas
        entrypointCandidates = areaFinder.findNeighbours(posLatLon)
        console.log("Found entrypoints", entrypointCandidates)
        trackingMap.setAreaMarker(entrypointCandidates)

        if (entrypointCandidates.length > 0) {
          let foundRoute: boolean = false

          // 3.A Stay on the same target if possible
          if (currentTarget != null && entrypointCandidates.find(ep => ep === currentTarget)) {
            console.log("Same entrypoint, new route")
            const routeCandidate = routingEngine.findRoute(startNode, NodeId(currentTarget.osmid), closestEdge.edge)
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
              const routeCandidate = routingEngine.findRoute(startNode, NodeId(entrypoint.osmid), closestEdge.edge)
              console.log("Checking candidate...", routeCandidate)
              if (routeCandidate && (routeCandidate.inTravelDirection || forceRecalculation)) {
                console.log("Found new route to new entrypoint")
                foundRoute = true
                currentRoute = routeCandidate
                currentTarget = entrypoint
                break
              }
            }
          }

          // We have a valid new route
          if(foundRoute && currentRoute){
            trackingMap.setSnappedEdge(segments)
            trackingMap.setRoute(currentRoute)

            if(currentTarget){
              const areaInfo = areaFinder.areaInfoById(currentTarget.area_id)
              previewMap.setArea(areaInfo)
              setDescription(`Area size: ${areaInfo.totalLength.toFixed(0)}m`)
              const totalDistance = accDistances(splitXY) + currentRoute.totalLength
              setDirections(formatDistance(totalDistance))
            }
          }else{
            setDescription("Nothing ahead...")
            setDirections("")
            trackingMap.clearRoute()
          }
        } else {
          // We have no target
          currentTarget = null
          currentRoute = null
          trackingMap.clearRoute()

          setDescription("Nothing around...")
          setDirections("")
        }
      }
    }
    forceRecalculation = false
    currentEdge = closestEdge.edge
  }else{
    // We are completely lost -> hide everything
    setDescription("The middle of Nowhere")
    setDirections("")

    trackingMap.clearRoute()
    previewMap.clearArea()
    trackingMap.clearAreaMarker()

    console.log("No trail close to current position")
    currentEdge = null
  }
}

function updateRouting2(){
  const closestEdge = routingEngine.findClosestEdge(posLatLon)
  if(closestEdge) {
    const edgeDirection = routingEngine.travelDirectionVector(heading.getDirection(), closestEdge)

    // Recalculate route if necessary
    if(currentTarget){
      if(currentRoute == null || forceRecalculation){
        const startNode = (edgeDirection == TravelDirection.U_TO_V) ? NodeId(closestEdge.edge.v) : NodeId(closestEdge.edge.u)
        const routeCandidate = routingEngine.findRoute(startNode, NodeId(currentTarget.osmid), closestEdge.edge)

        if(routeCandidate){
          currentRoute = routeCandidate
          forceRecalculation = false
        }
      }
    }

    // Draw route on map
    if(currentRoute){
      drawRoute(closestEdge, edgeDirection)
    }

    currentEdge = closestEdge.edge
  }else{
    // We don't really know where we are
    // We leave the route until we hit a graph edge
    setDescription("The middle of Nowhere")
    setDirections("")
  }
}

function drawRoute(closestEdge: EdgeIntersection, edgeDirection: TravelDirection|undefined){
  // 1. Prepare for routing - Starting node and heading
  let segments: LatLon[]
  let splitXY: Cartesian[]
  if (edgeDirection == TravelDirection.U_TO_V) {
    // Split current edge for drawing
    segments = closestEdge.edge.coordinates.slice(closestEdge.segmentIndex)
    segments[0] = interpolateLatLon(segments[0], segments[1], closestEdge.t)
    // Split projection for distance
    splitXY = closestEdge.edge.cartesian.slice(closestEdge.segmentIndex)
    splitXY[0] = interpolateCartesian(splitXY[0], splitXY[1], closestEdge.t)
  } else { // u
    // Split current edge for drawing
    segments = closestEdge.edge.coordinates.slice(0, closestEdge.segmentIndex + 2).reverse()
    segments[0] = interpolateLatLon(segments[0], segments[1], 1 - closestEdge.t)
    // Split projection for distance
    splitXY = closestEdge.edge.cartesian.slice(0, closestEdge.segmentIndex + 2)
    splitXY[0] = interpolateCartesian(splitXY[0], splitXY[1], 1 - closestEdge.t)
  }

  // 2. If we are still on the same edge, no need to recompute everything
  if(closestEdge.edge != currentEdge && currentRoute && currentRoute.routeEdges.length > 0) {
    // Have we progressed to the next route edge?
    const nextEdge = currentRoute.routeEdges[0]
    if(nextEdge == closestEdge.edge){
      console.log("Progressing along route")
      //currentEdge = nextEdge
      currentRoute.routeEdges.splice(0, 1) // Pop first edge
      currentRoute.totalLength -= nextEdge.length
    }else
    {
      // If we are off-route -> invalidate
      currentRoute = null
      forceRecalculation = true
    }
  }

  // 3. We have a valid route -> Draw line to target and update stats
  if(currentRoute){
    trackingMap.setSnappedEdge(segments)
    trackingMap.setRoute(currentRoute)

    const totalDistance = accDistances(splitXY) + currentRoute.totalLength
    setDirections(formatDistance(totalDistance))
  }else{
    setDescription("No valid route found")
    setDirections("")
    //trackingMap.setSnappedEdge([])
    //trackingMap.clearRoute()
  }
}

document.getElementById("next-area")!.addEventListener("click", (e) => {
  let nextIndex = 0
  const numCandidates = entrypointCandidates.length
  if(currentTarget) {
    const curIndex = entrypointCandidates.indexOf(currentTarget)
    nextIndex = curIndex + 1
  }
  nextIndex = (nextIndex + numCandidates) % numCandidates
  currentTarget = entrypointCandidates[nextIndex]
  forceRecalculation = true
})

document.getElementById("previous-area")!.addEventListener("click", (e) => {
  let nextIndex = 0
  const numCandidates = entrypointCandidates.length
  if(currentTarget) {
    const curIndex = entrypointCandidates.indexOf(currentTarget)
    nextIndex = curIndex - 1
  }
  nextIndex = (nextIndex + numCandidates) % numCandidates
  currentTarget = entrypointCandidates[nextIndex]
  forceRecalculation = true
})

async function loadConfig(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network error");
    statsData = await response.json();
    
    // bbox format: minLon, minLat, maxLon, maxLat
    regionBBox = mapBBox(statsData.bbox)
    projection = new CartesianProjection(bbCenter(regionBBox))

    splashSetStats(statsData["total_length"], statsData["areas"])
  } catch (err) {
    console.error("Failed to load Stats json:", err);
  }
}
async function loadData(){
  // First load stats
  await loadConfig(import.meta.env.BASE_URL + "data/stats.json")

  // Routing data
  routingEngine = new RoutingEngine(regionBBox)
  await routingEngine.init()

  // Areas and entrypoints
  areaFinder = new AreaFinder(regionBBox)
  await areaFinder.init()

  // Draw edges on map
  trackingMap.addRoutingLayer(routingEngine.routingGeoData)
  trackingMap.addFrequencyHeatmap(routingEngine.routingGeoData, statsData.ride_count_max)
  trackingMap.addDeadendsLayer(routingEngine.routingGeoData)

// Add a layer to the tracking map
  trackingMap.addAreaLayer(areaFinder.areaGeoData, areaFinder.entrypointsGeoData)

  console.log("All data loaded")
}

//  Load all application data
await loadData()

if(trackingEnabled && "geolocation" in navigator){
  registerTrackingListener()
}

setDebug("System ready...")

// SETTINGS
//=========

var currentSettings: Settings
function onSettingsChanged(s:Settings) {
  console.log("Settings changed...")
  console.log(s)
  currentSettings = s

  // Configure tracking map display
  trackingMap.toggleAreaBoundingBoxes(s.showAreaBBox)
  trackingMap.toggleDeadends(s.showDeadends)
  trackingMap.toggleFrequencyHeatmap(s.showFrequencyHeatmap)

  // Debug overlay
  document.getElementById("debug")!.style.visibility = s.showDebugOverlay ? "visible" : "hidden"

  console.log("Tile service", s.tileService)
  trackingMap.setBaseLayer(s.tileService)
}

settingsInit("settings", onSettingsChanged)

const settingsButton = document.getElementById("settings-open")!
settingsButton.addEventListener("click", (_:MouseEvent)=>{settingsShow()})

document.getElementById("arealist-open")!.addEventListener("click", (_:MouseEvent)=>{initAreaView(areaFinder)})

window.addEventListener("cycSelectArea", (e) =>{
  const event = e as CustomEvent
  const area = areaFinder.areaInfoById(event.detail.areaId)

  trackingMap.highlightArea(area)
  trackingMap.setAreaMarker(area.nodes)

  trackingMap.map.invalidateSize()
})

window.addEventListener("cycNavigateArea", (e) =>{
  const event = e as CustomEvent
  const area = areaFinder.areaInfoById(event.detail.areaId)
  console.log("Navigate to area " + area.area_id)

  // Temporary solution -> navigate to the first entrypoint
  if(area.nodes.length > 0){
    currentTarget = area.nodes[0]
    trackingMap.highlightArea(area)
    trackingMap.setAreaMarker(area.nodes)
    previewMap.setArea(area)

    entrypointCandidates = area.nodes

    forceRecalculation = true
  }

  trackingMap.map.invalidateSize()
})

// Stop following tracking if we pan the map, show button to re-center
const centerBtnEl = document.getElementById("center-btn")
centerBtnEl?.addEventListener("click", (e) =>{
  viewFollowTracking = true
  centerBtnEl.classList.add("hidden")
})

trackingMap.map.on("dragstart", (e) => {
  viewFollowTracking = false
  centerBtnEl?.classList.remove("hidden")
})