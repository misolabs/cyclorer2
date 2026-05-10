import type {EventBus} from "../eventbus.ts";
import {TrackingMap} from "../maps/trackingmap.ts";

import L, {LatLng} from "leaflet"

import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "../models/geo.ts";
import type {Settings} from "../services/settingsservice.ts";
import type {
    Area,
    LocationAnnotation,
    LocationAnnotationCategory,
    LocationAnnotationRequest
} from "../models/models.ts";
import {formatDistance, setDescription} from "../dom.ts";
import {jsonTimestamp} from "../helpers.ts";

const ellergronnGPS = new L.LatLng(49.477015, 5.980889)
const defaultZoomLevel = 17

export class TrackingView {
    bus: EventBus;
    mobileMode: boolean;

    trackingMap: TrackingMap
    viewFollowTracking: boolean
    maxRideCount: number = 0

    scoreTimerId: number = -1

    constructor(bus: EventBus, isMobileLike: boolean) {
        this.bus = bus;
        this.mobileMode = isMobileLike;
        this.viewFollowTracking = true

        this.trackingMap = new TrackingMap("tracking-map", isMobileLike, bus)

        this.bus.onEvent("rds:stats:loaded", this.onStatsDataLoaded.bind(this))
        this.bus.onEvent("rds:routing:loaded", this.onRoutingDataLoaded.bind(this))
        this.bus.onEvent("rds:areas:loaded", this.onAreaDataLoaded.bind(this))

        this.bus.onEvent("settings:updated", this.onSettingsChanged.bind(this))
        this.bus.onEvent("settings:loaded", this.onSettingsChanged.bind(this))

        this.bus.onEvent("geolocation:update", this.onGeoPositionChanged.bind(this))

        // UI requests to create an annotation marker here
        this.bus.onEvent("annotation:location:drophere", this.onLocationAnnotationDrophere.bind(this))
        // After location annotations are loaded we add them to the map
        this.bus.onEvent("annotation:location:loaded", this.onLocationAnnotationsLoaded.bind(this))

        this.bus.onEvent("exploration:score:updated", this.onScoreUpdated.bind(this))

        this.bus.onEvent("navigation:target:area", this.onNavigationArea.bind(this))
        this.bus.onEvent("navigation:stop", this.onNavigationStop.bind(this))

       // this.bus.eventOn("zoom:frame:rider", this.onZoomFrameRider.bind(this))

        // Show this when splash screen starts fading out
        this.bus.onEvent("splash:hiding", () => {document.getElementById("map-view")!.style.visibility = "visible";})

        // Hook up buttons
        // TODO Move these to the menu classes
        document.getElementById("settings-open")!.addEventListener("click", () => {this.bus.emitEvent("settings:show", true)})

        // View follow tracking
        // Stop following tracking if we pan the map, show button to re-center
        const centerBtnEl = document.getElementById("center-btn")
        centerBtnEl?.addEventListener("click", (e) =>{
            this.viewFollowTracking = true
            if(!this.mobileMode)
                this.trackingMap.positionMarker?.setLatLng(this.trackingMap.map.getCenter())

            centerBtnEl.classList.add("hide")
        })

        this.trackingMap.map.on("dragstart", (e) => {
            this.viewFollowTracking = false
            centerBtnEl?.classList.remove("hide")
        })
    }

    init() {
        this.trackingMap.map.setView(ellergronnGPS, defaultZoomLevel)

        this.trackingMap.addPositionMarker(ellergronnGPS, (this.mobileMode ? null : this.onPositionMarkerDragged.bind(this)))

        document.getElementById("zoom-toggle-btn")!.addEventListener("click", () => {this.toggleZoomLevel()})
        this.trackingMap.map.on("dblclick", (e) => {this.toggleZoomLevel()})
    }

    onStatsDataLoaded(stats: RoutingStatsJson) {
        this.maxRideCount = stats.ride_count_max
    }

    onRoutingDataLoaded(routingGeoData: GeoJsonRoutingollection) {
        console.log("Adding network map layers")
        this.trackingMap.addRoutingLayer(routingGeoData)
        this.trackingMap.addFrequencyHeatmap(routingGeoData, this.maxRideCount)
    }

    onAreaDataLoaded(areas: [GeoJsonAreaCollection, GeoJsonEntrypointCollection]){
        this.trackingMap.addAreaLayer(areas[0], areas[1])
    }

    onPositionMarkerDragged(e: L.DragEndEvent) {
        this.bus.emitEvent("geolocsim:update", {lat: e.target.getLatLng().lat, lon: e.target.getLatLng().lng })
    }

    onGeoPositionChanged(geo: GeolocationPosition){
        this.trackingMap.setPosition({lat:geo.coords.latitude, lon: geo.coords.longitude}, this.viewFollowTracking)
        if(geo.coords.heading && this.viewFollowTracking)
            this.trackingMap.setHeading(360 - geo.coords.heading)
    }

    onSettingsChanged(settings: Settings) {
        this.trackingMap.setBaseLayer(settings.tileService)
        this.trackingMap.toggleAreaBoundingBoxes(settings.showAreaBBox)
        this.trackingMap.toggleFrequencyHeatmap(settings.showFrequencyHeatmap)
    }

    onLocationAnnotationDrophere(category: LocationAnnotationCategory){
        const locationLatLng = this.trackingMap.positionMarker!.getLatLng()

        let text: string|null = null
        if(category == "TEXT")
            text = window.prompt("Annotation:")

        const annotation: LocationAnnotationRequest = {
            category: category,
            id: crypto.randomUUID(),
            text: text ? text : undefined, // Hack for null <-> undefined
            timestamp: jsonTimestamp(),
            location: {lat: locationLatLng.lat, lon: locationLatLng.lng},
        }

        // Add to tracking map
        this.trackingMap.addAnnotation(annotation)

        // Send to backend for storage
        this.bus.emitEvent("annotation:location:create", annotation)
    }

    onLocationAnnotationsLoaded(annotations: LocationAnnotation[]){
        for (const annotation of annotations) {
            this.trackingMap.addAnnotation(annotation)
        }
    }

    onScoreUpdated(score: number){
        document.getElementById("score")!.textContent = `${score.toFixed(0)}m`
    }

    onNavigationArea(area: Area){
        this.trackingMap.highlightArea(area)
        this.trackingMap.setAreaMarker(area.nodes)
        setDescription(`Area size: ${formatDistance(area.totalLength)}`)
    }

    onNavigationStop(){
        this.trackingMap.clearRoute()
        this.trackingMap.setSnappedEdge([])
        this.trackingMap.highlightArea(null)
    }

    toggleZoomLevel(){
        const toggle = document.getElementById("zoom-toggle-btn")!
        const glyph = toggle.querySelector("span")!

        if(glyph.textContent == "zoom_in"){
            glyph.textContent = "zoom_out"
            this.trackingMap.map.setZoom(this.trackingMap.riderViewZoom)
        }else{
            glyph.textContent = "zoom_in"
            this.trackingMap.map.setZoom(this.trackingMap.globalViewZoom)
        }
    }
}
