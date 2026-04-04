import type {EventBus} from "../eventbus.ts";
import {
    NavigationMode,
    type AnnotationCategory,
    type Area, type AreaNode,
    type BoundingBox, type Edge,
    type LatLon,
    type LocationAnnotation,
    type Route
} from "../models/models.ts";
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
import type {HeadingExp} from "../routing/heading.ts";
import {SetUtils} from "../setutils.ts";

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

    navigationMode: NavigationMode = NavigationMode.TM_EXPLORE
    currentArea: Area|null = null
    currentTarget: AreaNode|null = null
    currentRoute: Route|null = null
    entrypointCandidates: AreaNode[] = []
    forceRecalculation = false

    dismissed:Set<number> = new Set()
    dismissTimerId = -1

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
        //bus.on("data:sync", this.onDataSync.bind(this))

        bus.on("navigation:target:area", this.onNavigateArea.bind(this))
        bus.on("area:dismiss", this.onDismissArea.bind(this))
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

    onDismissArea(){
        if(this.dismissTimerId != -1) {
            clearTimeout(this.dismissTimerId)
            this.dismissTimerId = -1
        }

        this.currentTarget = null
        this.currentRoute = null

        if(this.currentArea)
            this.dismissed.add(this.currentArea.areaId)
        this.currentArea = null
    }

    onNavigateArea(area: Area){
        // Temporary solution -> navigate to the first entrypoint
        if(area.nodes.length > 0){
            this.currentTarget = area.nodes[0]

            this.entrypointCandidates = area.nodes
            this.forceRecalculation = true
        }
    }

    // =========
    update(){
        if(!this.routingEngine || !this.areaFinder) return
        const closestEdge = this.routingEngine.findClosestEdge(this.currentPosition)

        if(closestEdge){
            // Are we exploring an unvisited area? -> Keep score
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

            // If we are not exploring, we look for new targets in exploration mode
            if(this.navigationMode == NavigationMode.TM_EXPLORE && !this.currentTarget && !this.exploring)
                this.exploreNearbyAreas()
        }
    }

    exploreNearbyAreas(){
        if(this.areaFinder == undefined)
            return

        // Find all entrypoints in the neighbourhood and reduce to area ids
        const entries = this.areaFinder.findNeighbours(this.currentPosition)
        const areas: Set<number> = new Set()
        entries.forEach(c => areas.add(c.area_id))

        // Filter out the ones we have dismissed
        const candidates = SetUtils.difference(areas, this.dismissed)
        console.log(candidates.size)

        // Pick random candidate
        if(candidates.size > 0) {
            const i = Math.floor(Math.random() * (candidates.size - 1))
            const areaId = Array.from(candidates)[i]
            console.log(i)

            // Propose a new target area
            this.currentArea = this.areaFinder.areaInfoById(areaId)
            this.bus.emit("navigation:target:area", this.currentArea)

            // If we don't lock-onto the target within a certain time, we auto-dismis
            this.dismissTimerId = setTimeout( () => {this.bus.emit("area:dismiss")}, 60000)
        }
    }
}