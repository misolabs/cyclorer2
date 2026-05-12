import type { EventBus } from "../eventbus.ts";
import {
    NavigationMode,
    type Area, type AreaNode,
    type BoundingBox, type Route, NodeId,
    TravelDirection,
    type LatLon, type EdgeIntersection
} from "../models/models.ts";
import { RoutingEngine } from "../routing/routing.ts";
import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "../models/geo.ts";
import { mapBBox } from "../models/mapping.ts";
import { AreaFinder } from "../routing/areafinder.ts";
import { haversineDistance } from "../crs/latlonmath.ts";
import { AnnotationService } from "./annotationservice.ts";
import { computeHeading } from "../routing/heading.ts";
import { SetUtils } from "../setutils.ts";
import {cartesianDistance} from "../crs/cartesian.ts";
import type {Events} from "leaflet";

export class NavigationService{
    bus: EventBus;

    regionBB: BoundingBox|undefined
    routingEngine: RoutingEngine|undefined = undefined
    areaFinder: AreaFinder|undefined = undefined
    annotationService: AnnotationService

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

    nextJunction: NodeId | undefined = undefined
    junctionStableCount: number = 0

    dismissed:Set<number> = new Set()
    dismissTimerId = -1

    constructor(bus: EventBus) {
        this.bus = bus;
        this.annotationService = new AnnotationService(bus);

        bus.onEvent("geolocation:update", this.onGeoPositionChanged.bind(this));
        bus.onEvent("geolocsim:update", this.onGeoSimPositionChanged.bind(this));

        bus.onEvent("rds:stats:loaded", this.onStatsLoaded.bind(this));
        bus.onEvent("rds:areas:loaded", this.onAreasLoaded.bind(this));
        bus.onEvent("rds:routing:loaded", this.onRoutingLoaded.bind(this));

        bus.onEvent("navigation:target:area", this.onNavigateArea.bind(this));
        //bus.onEvent("area:dismiss", this.onDismissArea.bind(this));

        bus.onRequest("node:adjacency", this.onRequestNodeAdjacency.bind(this));
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

    onRequestNodeAdjacency(node: NodeId){
        return this.routingEngine?.nodesAdjacency.get(node)
    }

    // onDataSync and annotation backup logic should be moved to AnnotationService if needed

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

    // Calculate the distance from the intersection point to the endpoint <nodeId>
    computeDistanceToNode(closestEdge: EdgeIntersection, nodeId: NodeId){
        let totalLength = 0

        // Accumulate segments up to intersected segment
        for(let i=0; i < closestEdge.segmentIndex; i++){
            const p1 = closestEdge.edge.cartesian[i]
            const p2 = closestEdge.edge.cartesian[i + 1]
            totalLength += cartesianDistance(p1, p2)
        }

        // Add partial intersected edge length
        totalLength += cartesianDistance(
            closestEdge.edge.cartesian[closestEdge.segmentIndex],
            closestEdge.edge.cartesian[closestEdge.segmentIndex + 1]
        )

        // Length = u to intersection point
        // If we need distance to v, edge length - distance to u
        if(closestEdge.edge.v == nodeId)
            totalLength = closestEdge.edge.length - totalLength

        return totalLength
    }

    update(){
        if(!this.routingEngine || !this.areaFinder || !this.currentPosition) return
        const closestEdge = this.routingEngine.findClosestEdge(this.currentPosition)

        if(closestEdge){
            // EXPLORATION SCORE
            // Are we exploring an unvisited area? -> Keep score
            //--------------------------------------------------

            if(!this.exploring && closestEdge.edge.area_id){
                this.exploring = true
                const area: Area = this.areaFinder.areaInfoById(closestEdge.edge.area_id)
                this.bus.emitEvent("exploration:started", area)
            }else if(this.exploring){
                if(closestEdge.edge.area_id){
                    this.score += haversineDistance(this.lastPosition, this.currentPosition)
                    this.bus.emitEvent("exploration:score:updated", this.score)
                }
                else{
                    this.exploring = false
                    this.bus.emitEvent("exploration:ended")
                }
            }

            // JUNCTION PREVIEW
            // Determine next junction and broadcast if stable
            //------------------------------------------------

            if(this.lastPosition) {
                const travelDir = this.routingEngine.travelDirection(this.lastPosition, this.currentPosition, closestEdge)
                let pos = null
                let nodeId: NodeId | undefined
                let p1;
                if (travelDir == TravelDirection.U_TO_V) {
                    pos = closestEdge.edge.coordinates[closestEdge.edge.coordinates.length - 1]
                    nodeId = NodeId(closestEdge.edge.v)
                    p1 = closestEdge.edge.coordinates[closestEdge.edge.coordinates.length - 2]
                } else {
                    pos = closestEdge.edge.coordinates[0]
                    nodeId = NodeId(closestEdge.edge.u)
                    p1 = closestEdge.edge.coordinates[1]
                }

                // Check if we have the same junction prediction more than X times in a row
                if (nodeId != undefined && nodeId == this.nextJunction) {
                    this.junctionStableCount++
                } else {
                    this.junctionStableCount = 0
                    this.nextJunction = nodeId
                }

                // If stable -> send out the info
                if (this.junctionStableCount > 3) {
                    const junctionAngle = computeHeading(p1, pos)
                    const distance = this.computeDistanceToNode(closestEdge, nodeId)
                    const message = this.junctionStableCount == 4 ? "navigation:junction:upcoming" : "navigation:junction:update"
                    this.bus.emitEvent(message, {
                        nodeId,
                        pos,
                        travelEdge: closestEdge.edge,
                        orientation: junctionAngle,
                        distance
                    })
                }
            }
            /*
            // If we are not exploring, we look for new targets in exploration mode
            if(this.navigationMode == NavigationMode.TM_EXPLORE && !this.currentTarget && !this.exploring)
                this.exploreNearbyAreas()
             */
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
            this.bus.emitEvent("navigation:target:area", this.currentArea)

            // If we don't lock-onto the target within a certain time, we auto-dismis
            //this.dismissTimerId = setTimeout( () => {this.bus.emitEvent("area:dismiss")}, 60000)
        }
    }
}
