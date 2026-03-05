import 'bootstrap/dist/css/bootstrap.min.css'
import './css/map.css'
import './css/settings.css'

import L, { loadLegacyPlugins } from './leaflet-legacy'
await loadLegacyPlugins()

import type {StatsJson} from './models/geo.ts'
import {
  type AreaNode,
  type BoundingBox,
  type Edge,
  type LatLon,
  NodeId,
  type Route,
  TravelDirection
} from './models/models.ts'
import {mapBBox} from './models/mapping.ts'
import {TrackingMap} from './maps/trackingmap'
import {AreaFinder} from "./routing/areafinder.ts"
import {RoutingEngine} from "./routing/routing.ts";
import {bbCenter, geoToLatLon, interpolateLatLon} from "./crs/latlonmath.ts";
import {PreviewMap} from "./maps/previewmap.ts";
import {formatDistance, setDebug, setDescription} from "./dom.ts";
import {HeadingExp} from "./routing/heading.ts";
import {CartesianProjection} from "./helpers.ts";
import {type Settings, settingsInit, settingsShow} from "./settings.ts";

const isMobileLike = window.matchMedia("(pointer: coarse)").matches;
//const isMobileLike = true

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson

var regionBBox: BoundingBox
var routingEngine!: RoutingEngine
var areaFinder!: AreaFinder
export var projection: CartesianProjection

const trackingMap: TrackingMap = new TrackingMap("tracking-map")
//trackingMap.initBaseLayer(ellergronnGPS, 16)
// TODO - Integrate zoom level into settings
trackingMap.map.setView(ellergronnGPS, 16)

trackingMap.addPositionMarker(ellergronnGPS, (isMobileLike ? null : moveListener))
if(!isMobileLike)
  trackingMap.addHeadingMarker(ellergronnGPS, headingMarkerListener)

const previewMap: PreviewMap = new PreviewMap("preview-map")

let headingLatLon: LatLon = geoToLatLon(ellergronnGPS)
let posLatLon: LatLon = geoToLatLon(ellergronnGPS)

var watchId: number = -1
var trackingEnabled = isMobileLike // Enable on mobile

function headingMarkerListener(e: L.DragEndEvent){
  headingLatLon = geoToLatLon(e.target.getLatLng())

  const posXY = projection.fromLatlon(posLatLon)
  const headingXY = projection.fromLatlon(headingLatLon)
  heading.reinit(posXY, headingXY, 2.0)
  trackingMap.map.setBearing(heading.getBearing())

  updateRouting()
}

function moveListener(e: L.DragEndEvent) {
  posLatLon = geoToLatLon(e.target.getLatLng())

  // Debugging rotation
  const posXY = projection.fromLatlon(posLatLon)
  const headingXY = projection.fromLatlon(headingLatLon)
  heading.reinit(posXY, headingXY, 2.0)
  trackingMap.map.setBearing(heading.getBearing())

  e.target.bindPopup(`Coordinates: <br/><b>${posLatLon.lat.toFixed(0)}<br/>${posLatLon.lon.toFixed(0)}</b>`)
  updateRouting()
}

function trackingListener(pos: GeolocationPosition){
  posLatLon = {lat: pos.coords.latitude, lon: pos.coords.longitude}
  trackingMap.setPosition(posLatLon)

  const posXY = projection.fromLatlon(posLatLon)
  heading.update(posXY, pos.coords.speed)
  const smoothBearing = Math.round(heading.getBearing() / 5 ) * 5
  trackingMap.map.setBearing(smoothBearing)

  setDebug(`Angle: ${heading.getBearing()} \n Dir: (${heading.getDirection()?.x}, ${heading.getDirection()?.y})`)
  updateRouting()
}

function registerTrackingListener(){
  watchId = navigator.geolocation.watchPosition(
      trackingListener,
      (err) => console.warn("Geolocation error:", err.message),
      { enableHighAccuracy: true }
  );
}

var currentEntrypoint: AreaNode|null
var currentEdge: Edge|null
var currentRoute: Route|null
var heading: HeadingExp = new HeadingExp()

function updateRouting(){
  const closestEdge = routingEngine.findClosestEdge(posLatLon)

  if(closestEdge){
//    const edgeDirection = routingEngine.travelDirection(posLatLon, headingLatLon, closestEdge)
    const edgeDirection = routingEngine.travelDirectionVector(heading.getDirection(), closestEdge)

    // Prepare for routing - Starting node and heading
    let startNode: NodeId
    let segments: LatLon[]
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
    if(closestEdge.edge.ride_count == 0 && closestEdge.edge.area_id != undefined){
      setDescription("GO Explore!")
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
          let foundRoute: boolean = false

          // 3.A Stay on the same target if possible
          if (currentEntrypoint != null && entrypointCandidates.find(ep => ep === currentEntrypoint)) {
            console.log("Same entrypoint, new route")
            const routeCandidate = routingEngine.findRoute(startNode, NodeId(currentEntrypoint.osmid), closestEdge.edge)
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
            if(currentEntrypoint){
              const areaInfo = areaFinder.areaInfoById(currentEntrypoint.area_id)
              previewMap.setArea(areaInfo)
              setDescription(formatDistance(areaInfo.totalLength))
            }
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
    projection = new CartesianProjection(bbCenter(regionBBox))

    //uiUpdateStats(statsData["total_length"], statsData["areas"])
    //document.getElementById("stats-total-length").classList.add("fadein-slow")
    //document.getElementById("stats-areas-count").classList.add("fadein-slow")
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

function onSettingsChanged(s:Settings) {
  console.log("Settings changed...")
  console.log(s)

  // Configure tracking map display
  trackingMap.toggleAreaBoundingBoxes(s.showAreaBBox)
  trackingMap.toggleDeadends(s.showDeadends)

  // Debug overlay
  document.getElementById("debug")!.style.visibility = s.showDebugOverlay ? "visible" : "hidden"

  console.log("Tile service", s.tileService)
  trackingMap.setBaseLayer(s.tileService)
}

settingsInit("settings", onSettingsChanged)

const settingsButton = document.getElementById("settings-open")!
settingsButton.addEventListener("click", (_:MouseEvent)=>{settingsShow()})