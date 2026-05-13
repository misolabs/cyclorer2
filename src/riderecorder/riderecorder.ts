// Simple ride recorder that adds all edges that have been matched at least 3 times in a row

import type {EventBus} from "../eventbus.ts";
import type {Edge, LatLon} from "../models/models.ts";

export class RideRecorder {
    bus: EventBus
    rideEdges: Map<string, Edge> = new Map()
    lastMatchedEdge: string | undefined
    stableMatchingCounter= 0

    constructor(bus: EventBus) {
        this.bus = bus

        this.bus.onEvent("geolocation:update", this.onPositionChanged.bind(this))
        this.bus.onEvent("geolocsim:update", this.onSimulationPositionChanged.bind(this))
    }

    onSimulationPositionChanged(pos: LatLon){
        this.matchPositionToEdge(pos)
    }

    onPositionChanged(gps: GeolocationPosition) {
        this.matchPositionToEdge({lat: gps.coords.latitude, lon: gps.coords.longitude})
    }

    matchPositionToEdge(pos: LatLon){
        console.log("matching")
        const closestEdge = this.bus.request("routing:closestedge:pos", pos)

        if(closestEdge && !this.rideEdges.get(closestEdge.edge.edge_id)){
            if(!this.lastMatchedEdge || this.lastMatchedEdge == closestEdge.edge.edge_id){
                this.stableMatchingCounter++

                if(this.stableMatchingCounter > 2){
                    this.rideEdges.set(closestEdge.edge.edge_id, closestEdge.edge)

                    // Send message to draw on map
                    this.bus.emitEvent("map:snailtrail:add:edge", closestEdge.edge)
                }
            }else
                this.stableMatchingCounter = 0

            this.lastMatchedEdge = closestEdge.edge.edge_id
        }
    }
}