import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import type {  StatsJson } from './geo'
import type {BoundingBox} from './models'
import { mapBBox } from './mapping'
import { TrackingMap } from './maps/trackingmap'
import {AreaFinder} from "./areafinder.ts";
import {RoutingEngine} from "./routing.ts";
import {geoToLatLon} from "./latlonmath.ts";

const homeGPS = new L.LatLng(49.4986211, 5.9763811)
const ellergronnGPS = new L.LatLng(49.477015, 5.980889)

var statsData: StatsJson

var regionBBox: BoundingBox
var routingEngine!: RoutingEngine
var areaFinder!: AreaFinder

const trackingMap: TrackingMap = new TrackingMap("map")
trackingMap.initBaseLayer(ellergronnGPS, 15)
trackingMap.addPositionMarker(ellergronnGPS, moveListener)

function moveListener(e: L.DragEndEvent){
  e.target.bindPopup(`Coordinates: <br/><b>${e.target.getLatLng().lat}<br/>${e.target.getLatLng().lng}</b>`)
  const areas = areaFinder.findNeighbours(geoToLatLon(e.target.getLatLng()))
  console.log(areas)
  trackingMap.setAreaMarker(areas)
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

