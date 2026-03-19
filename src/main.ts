import 'bootstrap/dist/css/bootstrap.min.css'
import './css/icons.css'
import './css/map.css'
import './css/settings.css'
import './css/splash.css'

import L, { loadLegacyPlugins } from './leaflet-legacy'
await loadLegacyPlugins()

import type {StatsJson} from './models/geo.ts'
import {
  type Area,
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
import {SetUtils} from "./setutils.ts";
import {TrackingView} from "./views/trackingview.ts";

registerSW({
  immediate: true
})

const isMobileLike = window.matchMedia("(pointer: coarse)").matches;

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
export var posLatLon: LatLon = geoToLatLon(ellergronnGPS)
let lastPosLatLon: LatLon = geoToLatLon(ellergronnGPS)

var viewFollowTracking = true
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

  // Set bearing
  heading.reinit(posXY, headingXY, 2.0)
  trackingMap.map.setBearing(heading.getBearing())

  if(navigationMode == NavigationMode.TM_EXPLORE && !currentTarget && !exploring)
    exploreNearbyAreas()

  // Update routing
  handleNavigation()
  keepScore()

  // If we are currently exploring an area, show our position on the preview map
  // Else revert to the navigation target area
  if(exploring){
    if(currentEdge && currentEdge.area_id){
      previewMap.setArea(areaFinder.areaInfoById(currentEdge.area_id))
      previewMap.setPosition(posLatLon)
    }
  }else{
    if(currentArea){
      previewMap.setArea(currentArea)
    }
  }
}

function trackingListener(pos: GeolocationPosition){
  if(currentSettings.toggleOverlaysWhenRiding && pos.coords.speed)
    TrackingView.toggleUIOverlays(pos.coords.speed)

  posLatLon = {lat: pos.coords.latitude, lon: pos.coords.longitude}
  trackingMap.setPosition(posLatLon, viewFollowTracking)

  const posXY = projection.fromLatlon(posLatLon)
  heading.update(posXY, pos.coords.speed)
  const smoothBearing = Math.round(heading.getBearing() / 5 ) * 5

  if(viewFollowTracking)
    trackingMap.map.setBearing(smoothBearing)

  if(navigationMode == NavigationMode.TM_EXPLORE && !currentTarget && !exploring)
    exploreNearbyAreas()

  handleNavigation()
  keepScore()
}

var scoreTimerId = -1
function keepScore(){
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
  navigator.geolocation.watchPosition(
      trackingListener,
      (err) => console.warn("Geolocation error:", err.message),
      { enableHighAccuracy: true }
  );
}

var navigationMode: NavigationMode = NavigationMode.TM_EXPLORE
var currentArea: Area|null = null
var currentTarget: AreaNode|null
var currentEdge: Edge|null
var currentRoute: Route|null
var heading: HeadingExp = new HeadingExp()
var entrypointCandidates: AreaNode[] = []
var forceRecalculation = false

const dismissed:Set<number> = new Set()
var dismissTimerId = -1
function exploreNearbyAreas(){
  // Find all entrypoints in the neighbourhood and reduce to area ids
  const entries = areaFinder.findNeighbours(posLatLon)
  const areas: Set<number> = new Set()
  entries.forEach(c => areas.add(c.area_id))

  // Filter out the ones we have dismissed
  const candidates = SetUtils.difference(areas, dismissed)
  console.log(candidates.size)

  // Pick random candidate
  if(candidates.size > 0) {
    const i = Math.floor(Math.random() * (candidates.size - 1))
    const areaId = Array.from(candidates)[i]
    console.log(i)

    // Propose a new target area
    window.dispatchEvent(new CustomEvent("cycNavigateArea", {detail: {areaId: areaId}}))
    TrackingView.toggleEngageButton(true)
    TrackingView.toggleStopNavigationButton(false)
    TrackingView.toggleDismissButton(true)

    // If we don't lock-onto the target within a certain time, we auto-dismis
    dismissTimerId = setTimeout(dismissArea, 60000)
  }
}

document.getElementById("dismiss-area-btn")!.addEventListener("click", dismissArea)

document.getElementById("engage-area-btn")!.addEventListener("click", () => {
  if(dismissTimerId != -1) {
    clearTimeout(dismissTimerId)
    dismissTimerId = -1
  }

  TrackingView.toggleEngageButton(false)
  TrackingView.toggleStopNavigationButton(true)
  TrackingView.toggleDismissButton(false)
})

document.getElementById("stop-navigation-btn")!.addEventListener("click", () => {
  currentTarget = null
  currentRoute = null
  currentArea = null

  trackingMap.clearRoute()
  trackingMap.setSnappedEdge([])
  trackingMap.highlightArea(null)

  TrackingView.toggleStopNavigationButton(false)
})

function dismissArea(){
  if(dismissTimerId != -1) {
    clearTimeout(dismissTimerId)
    dismissTimerId = -1
  }

  currentTarget = null
  currentRoute = null

  if(currentArea)
    dismissed.add(currentArea.area_id)
  currentArea = null

  trackingMap.clearRoute()
  trackingMap.setSnappedEdge([])
  trackingMap.highlightArea(null)

  TrackingView.toggleEngageButton(false)
  TrackingView.toggleDismissButton(false)
}

function handleNavigation(){
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
    }else{
      previewMap.clearArea()
      setDescription("")
      setDirections("")
      trackingMap.clearRoute()
      trackingMap.setSnappedEdge([])
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
    //setDescription("No valid route found")
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

// Application data
//=================

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

// -------------------------

document.getElementById("arealist-open")!.addEventListener("click", (_:MouseEvent)=>{initAreaView(areaFinder, isMobileLike)})

window.addEventListener("cycSelectArea", (e) =>{
  const event = e as CustomEvent
  const area = areaFinder.areaInfoById(event.detail.areaId)

  trackingMap.highlightArea(area)
  trackingMap.setAreaMarker(area.nodes)

  trackingMap.map.invalidateSize()
})

window.addEventListener("cycNavigateArea", (e) =>{
  const event = e as CustomEvent
  currentArea = areaFinder.areaInfoById(event.detail.areaId)
  console.log("Navigate to area " + currentArea.area_id)

  // Temporary solution -> navigate to the first entrypoint
  if(currentArea.nodes.length > 0){
    currentTarget = currentArea.nodes[0]

    trackingMap.highlightArea(currentArea)
    trackingMap.setAreaMarker(currentArea.nodes)
    previewMap.setArea(currentArea)
    setDescription(`Area size: ${formatDistance(currentArea.totalLength)}`)

    TrackingView.toggleDismissButton(true)
    TrackingView.toggleEngageButton(true)

    entrypointCandidates = currentArea.nodes
    forceRecalculation = true
  }

  trackingMap.map.invalidateSize()
})

window.addEventListener("invalidateMap", (e) =>{
  trackingMap.map.invalidateSize(true)
  previewMap.map.invalidateSize(true)
})

// Listen for events from settings view to open area list
window.addEventListener("cycShowAreaList", (e) =>{initAreaView(areaFinder, isMobileLike)})

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
