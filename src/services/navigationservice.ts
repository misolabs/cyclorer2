import type {EventBus} from "../eventbus.ts";
import type {AnnotationCategory, Area, BoundingBox, LatLon, LocationAnnotation} from "../models/models.ts";
import {RoutingEngine} from "../routing/routing.ts";
import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "../models/geo.ts";
import {mapBBox} from "../models/mapping.ts";
import {AreaFinder} from "../routing/areafinder.ts";
import {haversineDistance} from "../crs/latlonmath.ts";
import {AnnotationRepo} from "./annotationrepo.ts";

export class NavigationService{
    bus: EventBus;

    regionBB: BoundingBox|undefined
    routingEngine: RoutingEngine|undefined = undefined
    areaFinder: AreaFinder|undefined = undefined
    annotationRepo: AnnotationRepo

    currentPosition!: LatLon
    lastPosition!: LatLon

    exploring = false
    score = 0

    constructor(bus: EventBus) {
        this.bus = bus;
        this.annotationRepo = new AnnotationRepo()

        bus.on("geolocation:update", this.onGeoPositionChanged.bind(this))
        bus.on("geolocsim:update", this.onGeoSimPositionChanged.bind(this))

        bus.on("annotation:location:add", this.onAddAnnotationRequest.bind(this))
        bus.on("annotation:location:delete", this.onDeleteAnnotationRequest.bind(this))

        bus.on("rds:stats:loaded", this.onStatsLoaded.bind(this))
        bus.on("rds:areas:loaded", this.onAreasLoaded.bind(this))
        bus.on("rds:routing:loaded", this.onRoutingLoaded.bind(this))

        bus.on("system:ready", this.onSystemReady.bind(this))
        bus.on("data:sync", this.onDataSync.bind(this))
    }

    // Called when everything is in place
    onSystemReady(){
        // Add location annotations to the map
        this.annotationRepo.getAll().forEach((a: LocationAnnotation) => {this.bus.emit("annotation:location:added", a)})
    }

    // Position update from simulation mode
    onGeoSimPositionChanged(p: LatLon){
        this.lastPosition = this.currentPosition
        this.currentPosition = p
        this.update()
    }

    // Position update from GPS
    onGeoPositionChanged(geo: GeolocationPosition) {
        this.lastPosition = this.currentPosition
        this.currentPosition = {lat: geo.coords.latitude, lon: geo.coords.longitude}
        this.update()
    }

    onAddAnnotationRequest(category: AnnotationCategory){
        const ts = new Date(Date.now()).toJSON()
        const annotation = this.annotationRepo.add({location: this.currentPosition, category: category, timestamp: ts})

        // Tell everyone about this one
        this.bus.emit("annotation:location:added", annotation)
    }

    onDeleteAnnotationRequest(id: number){
        console.log("Delete annotation request", id)
        this.annotationRepo.delete(id)
    }

    onStatsLoaded(stats: RoutingStatsJson){
        this.regionBB = mapBBox(stats.bbox)
        this.routingEngine = new RoutingEngine(this.regionBB)
    }

    onAreasLoaded(areas: [GeoJsonAreaCollection, GeoJsonEntrypointCollection]){
        if(this.regionBB) {
            this.areaFinder = new AreaFinder(this.regionBB)
            this.areaFinder.init(areas[0], areas[1])
        }
    }

    onRoutingLoaded(routingData:GeoJsonRoutingollection){
        if(this.routingEngine) {
            this.routingEngine.init(routingData)
        }
    }

    onDataSync(){
        // Collect data from all sources and sync with computer
        // Currently send an email

        const data = this.annotationRepo.getAll();
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const file = new File([blob], "annotations.json");

        navigator.share({
            title: "Cyclorer 2 Backup - Annotations",
            text: "Cyclorer 2 Backup",
            files: [file]
        });
    }

    // =========
    update(){
        if(!this.routingEngine || !this.areaFinder) return
        const closestEdge = this.routingEngine.findClosestEdge(this.currentPosition)

        if(closestEdge){
            // Are we exploring an unvisited area?
            if(!this.exploring && closestEdge.edge.area_id){
                this.exploring = true
                const area: Area = this.areaFinder.areaInfoById(closestEdge.edge.area_id)
                this.bus.emit("exploration:started", area)
            }else if(this.exploring){
                if(closestEdge.edge.area_id){
                    this.score += haversineDistance(this.lastPosition, this.currentPosition)
                    this.bus.emit("exploration:score:updated", this.score)
                }
                else{
                    this.exploring = false
                    this.bus.emit("exploration:ended")
                }
            }
        }
    }
}