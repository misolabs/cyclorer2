import type {EventBus} from "../eventbus.ts";
import {TrackingMap} from "../maps/trackingmap.ts";
import {PreviewMap} from "../maps/previewmap.ts";

import L, {LatLng} from "leaflet"
import "../lib/leaflet-icon-glyph.js"

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
import {formatDistance, setDescription} from "../dom.ts";

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

        this.trackingMap = new TrackingMap("tracking-map", isMobileLike, bus)
        this.previewMap = new PreviewMap("preview-map", bus)

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

        this.bus.on("area:dismiss", this.onAreaDismiss.bind(this))
        this.bus.on("area:engage", this.onAreaEngage.bind(this))
        this.bus.on("navigation:target:area", this.onNavigationArea.bind(this))
        this.bus.on("navigation:stop", this.onNavigationStop.bind(this))

        this.bus.on("zoom:frame:rider", this.onZoomFrameRider.bind(this))

        // Show this when splash screen starts fading out
        this.bus.on("splash:hiding", () => {document.getElementById("map-view")!.style.visibility = "visible";})

        // Hook up buttons
        // TODO Move these to the menu classes
        document.getElementById("settings-open")!.addEventListener("click", () => {this.bus.emit("settings:show", true)})

        // Navigation control buttons
        document.getElementById("dismiss-area-btn")!.addEventListener("click", () => {this.bus.emit("area:dismiss")})
        document.getElementById("engage-area-btn")!.addEventListener("click", () => {this.bus.emit("area:engage")})
        document.getElementById("stop-navigation-btn")!.addEventListener("click", () => {this.bus.emit("navigation:stop")})

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

        // TODO Experimental - Add text annotation
        document.getElementById("drop-pin-text")!.addEventListener("click", () =>
        {
            const text = window.prompt("Annotation:")
            if(text)
                this.bus.emit("annotation:location:text:create", text)
        })

    }

    init() {
        this.trackingMap.map.setView(ellergronnGPS, defaultZoomLevel)

        this.trackingMap.addPositionMarker(ellergronnGPS, (this.mobileMode ? null : this.onPositionMarkerDragged.bind(this)))

        // Show buttons overlay on click
        this.trackingMap.map.on("click", (e) => {
            const root = document.getElementById("ui-midride-menu")!
            if(root.classList.contains("hide")) {
                root.classList.remove("hide")
                setTimeout( () => {root.classList.add("hide") }, 20000)
            }else root.classList.add("hide")
        })
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

    onPositionMarkerDragged(e: L.DragEndEvent) {
        this.bus.emit("geolocsim:update", {lat: e.target.getLatLng().lat, lon: e.target.getLatLng().lng })
    }

    onGeoPositionChanged(geo: GeolocationPosition){
        this.trackingMap.setPosition({lat:geo.coords.latitude, lon: geo.coords.longitude}, this.viewFollowTracking)
        if(geo.coords.heading && this.viewFollowTracking)
            this.trackingMap.setHeading(360 - geo.coords.heading)
    }

    onSettingsChanged(settings: Settings) {
        this.trackingMap.setBaseLayer(settings.tileService)
        this.trackingMap.toggleDeadends(settings.showDeadends)
        this.trackingMap.toggleAreaBoundingBoxes(settings.showAreaBBox)
        this.trackingMap.toggleFrequencyHeatmap(settings.showFrequencyHeatmap)
    }

    onAnnotationAdded(annotation: LocationAnnotation){
        if(annotation.category === "TEXT" && annotation.text)
            this.trackingMap.addTextAnnotation(annotation)
        else
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

    onAreaDismiss(){
        this.trackingMap.clearRoute()
        this.trackingMap.setSnappedEdge([])
        this.trackingMap.highlightArea(null)
        this.trackingMap.clearAreaMarker()

        this.previewMap.clearArea()
        setDescription("")

        this.toggleEngageButton(false)
        this.toggleDismissButton(false)
    }

    onAreaEngage(){
        this.toggleEngageButton(false)
        this.toggleStopNavigationButton(true)
        this.toggleDismissButton(false)
    }

    onNavigationArea(area: Area){
        this.toggleEngageButton(true)
        this.toggleStopNavigationButton(false)
        this.toggleDismissButton(true)

        this.trackingMap.highlightArea(area)
        this.trackingMap.setAreaMarker(area.nodes)
        this.previewMap.setArea(area)
        setDescription(`Area size: ${formatDistance(area.totalLength)}`)
    }

    onNavigationStop(){
        this.trackingMap.clearRoute()
        this.trackingMap.setSnappedEdge([])
        this.trackingMap.highlightArea(null)

        this.toggleStopNavigationButton(false)
    }

    onZoomFrameRider(){
        this.trackingMap.zoomFrameRider()
    }

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