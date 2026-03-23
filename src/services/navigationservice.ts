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

export class NavigationService{
    bus: EventBus;

    regionBB: BoundingBox|undefined
    routingEngine: RoutingEngine|undefined = undefined
    areaFinder: AreaFinder|undefined = undefined

    currentPosition!: LatLon
    lastPosition!: LatLon

    exploring = false
    score = 0

    constructor(bus: EventBus) {
        this.bus = bus;

        bus.on("geolocation:update", this.onGeoPositionChanged.bind(this))
        bus.on("geolocsim:update", this.onGeoSimPositionChanged.bind(this))
        bus.on("annotation:location:add", this.onAddAnnotationRequest.bind(this))

        bus.on("rds:stats:loaded", this.onStatsLoaded.bind(this))
        bus.on("rds:areas:loaded", this.onAreasLoaded.bind(this))
        bus.on("rds:routing:loaded", this.onRoutingLoaded.bind(this))
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
        // TODO Add to repostory
        const annotation: LocationAnnotation = {location: this.currentPosition, category: category}
        // Tell everyone about this one
        this.bus.emit("annotation:location:added", annotation)
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