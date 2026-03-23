import type {EventBus} from "../eventbus.ts";
import {TrackingMap} from "../maps/trackingmap.ts";
import {PreviewMap} from "../maps/previewmap.ts";

import L, {LatLng} from "leaflet"

import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "../models/geo.ts";
import type {Settings} from "../services/settingsservice.ts";
import {geoToLatLon} from "../crs/latlonmath.ts";
import type {GeolocationLight} from "../services/geolocationservice.ts";
import type {Area, AreaId, LocationAnnotation} from "../models/models.ts";

/*  TODO
    - heading
    - dragging position marker
    - heading marker?
 */

var isUIOverlayVisible = true

const ellergronnGPS = new L.LatLng(49.477015, 5.980889)
const defaultZoomLevel = 17

export class TrackingView {
    bus: EventBus;
    mobileMode: boolean;

    trackingMap: TrackingMap
    previewMap: PreviewMap
    viewFollowTracking: boolean
    maxRideCount: number = 0

    scoreTimerId: number = -1

    constructor(bus: EventBus, isMobileLike: boolean) {
        this.bus = bus;
        this.mobileMode = isMobileLike;
        this.viewFollowTracking = true

        this.trackingMap = new TrackingMap("tracking-map", isMobileLike)
        this.previewMap = new PreviewMap("preview-map")

        this.bus.on("rds:stats:loaded", this.onStatsDataLoaded.bind(this))
        this.bus.on("rds:routing:loaded", this.onRoutingDataLoaded.bind(this))
        this.bus.on("rds:areas:loaded", this.onAreaDataLoaded.bind(this))

        this.bus.on("settings:updated", this.onSettingsChanged.bind(this))
        this.bus.on("settings:loaded", this.onSettingsChanged.bind(this))

        this.bus.on("geolocation:update", this.onGeoPositionChanged.bind(this))

        this.bus.on("annotation:location:added", this.onAnnotationAdded.bind(this))

        this.bus.on("exploration:started", this.onExplorationStarted.bind(this))
        this.bus.on("exploration:ended", this.onExplorationEnded.bind(this))
        this.bus.on("exploration:score:updated", this.onScoreUpdated.bind(this))

        // Show this when splash screen starts fading out
        this.bus.on("splash:hiding", () => {document.getElementById("map-view")!.style.visibility = "visible";})

        // Hook up buttons
        // TODO Move these to the menu classes
        document.getElementById("settings-open")!.addEventListener("click", () => {this.bus.emit("settings:show", true)})

        // View follow tracking
        // Stop following tracking if we pan the map, show button to re-center
        const centerBtnEl = document.getElementById("center-btn")
        centerBtnEl?.addEventListener("click", (e) =>{
            this.viewFollowTracking = true
            centerBtnEl.classList.add("hidden")
        })

        this.trackingMap.map.on("dragstart", (e) => {
            this.viewFollowTracking = false
            centerBtnEl?.classList.remove("hidden")
        })
    }

    init() {
        this.trackingMap.map.setView(ellergronnGPS, defaultZoomLevel)

        this.trackingMap.addPositionMarker(ellergronnGPS, (this.mobileMode ? null : this.onPositionMarkerDragged.bind(this)))
        /*if(!this.mobileMode) {
            this.trackingMap.addHeadingMarker(ellergronnGPS, this.onHeadingMarkerDragged.bind(this))
            setInterval(this.onSimulationTimer.bind(this), 2000)
        }*/
    }

    onStatsDataLoaded(stats: RoutingStatsJson) {
        this.maxRideCount = stats.ride_count_max
    }

    onRoutingDataLoaded(routingGeoData: GeoJsonRoutingollection) {
        console.log("Adding network map layers")
        this.trackingMap.addRoutingLayer(routingGeoData)
        this.trackingMap.addDeadendsLayer(routingGeoData)
        this.trackingMap.addFrequencyHeatmap(routingGeoData, this.maxRideCount)
    }

    onAreaDataLoaded(areas: [GeoJsonAreaCollection, GeoJsonEntrypointCollection]){
        this.trackingMap.addAreaLayer(areas[0], areas[1])
    }

    onHeadingMarkerDragged(e: L.DragEndEvent){
        //headingLatLon = geoToLatLon(e.target.getLatLng())
    }

    onPositionMarkerDragged(e: L.DragEndEvent) {
        this.bus.emit("geolocsim:update", {lat: e.target.getLatLng().lat, lon: e.target.getLatLng().lng })
    }

    onGeoPositionChanged(geo: GeolocationPosition){
        this.trackingMap.setPosition({lat:geo.coords.latitude, lon: geo.coords.longitude}, this.viewFollowTracking)
        if(geo.coords.heading)
            this.trackingMap.setHeading(geo.coords.heading)
    }

    // TODO - Move this somewhere else?
    onSimulationTimer(){
    }

    onSettingsChanged(settings: Settings) {
        this.trackingMap.setBaseLayer(settings.tileService)
        this.trackingMap.toggleDeadends(settings.showDeadends)
        this.trackingMap.toggleAreaBoundingBoxes(settings.showAreaBBox)
        this.trackingMap.toggleFrequencyHeatmap(settings.showFrequencyHeatmap)
    }

    onAnnotationAdded(annotation: LocationAnnotation){
        this.trackingMap.addAnnotation(annotation)
    }

    onExplorationStarted(area: Area){
        if(this.scoreTimerId != -1){
            clearTimeout(this.scoreTimerId)
            this.scoreTimerId = -1
        }

        document.getElementById("score")!.classList.add("counting")
        this.previewMap.setArea(area)
    }

    onExplorationEnded(){
        this.scoreTimerId = setTimeout(() => {
            document.getElementById("score")!.classList.remove("counting")
            this.scoreTimerId = -1
        }, 5000)
    }

    onScoreUpdated(score: number){
        document.getElementById("score")!.textContent = `${score.toFixed(0)}m`
    }

    // TODO: Still needed?
    toggleDismissButton(show: boolean) {
        if(show)
            document.getElementById("dismiss-area-btn")!.classList.remove("hide")
        else
            document.getElementById("dismiss-area-btn")!.classList.add("hide")
    }

    toggleEngageButton(show: boolean) {
    if(show)
        document.getElementById("engage-area-btn")!.classList.remove("hide")
    else
        document.getElementById("engage-area-btn")!.classList.add("hide")
    }

    toggleStopNavigationButton(show: boolean) {
    if(show)
        document.getElementById("stop-navigation-btn")!.classList.remove("hide")
    else
        document.getElementById("stop-navigation-btn")!.classList.add("hide")
    }

    // Hide UI when we ride
    // Elements to toggle are marked with a css class
    toggleUIOverlays(speed: number) {
        const overlayElements = document.querySelectorAll(".ui-overlay-element")
        // Slowing down -> show
        if(speed < 1.0 && !isUIOverlayVisible) {
            overlayElements.forEach(overlayElement => {
                overlayElement.classList.remove("hide")
            })
            isUIOverlayVisible = true
            // Speeding up -> hide
        }else if(speed > 2.0 && isUIOverlayVisible) {
            for(const el of overlayElements) {
                if (!el.classList.contains("hide")) {
                    el.classList.add("hide")
                }
            }
            isUIOverlayVisible = false
        }
    }

}