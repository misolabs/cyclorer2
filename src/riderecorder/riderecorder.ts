// Simple ride recorder that adds all edges that have been matched at least 3 times in a row

import type {EventBus} from "../eventbus.ts";
import {type AdjacencyInfo, type Edge, type LatLon, NodeId, NotificationType} from "../models/models.ts";

// Check if two edges share a node
function sharedNode(e1: Edge, e2: Edge){
    if(!e1 || !e2) return undefined

    if(
        e1.u == e2.u ||
        e1.u == e2.v
    ) return e1.u

    else if (
        e1.v == e2.u ||
        e1.v == e2.v
    ) return e1.v
    return undefined
}

// Given edges e1, e2, e3 check if e1 is connected to e3
// through the same node that e1 is connected to e2 and e3 to e2
// This is very probably only a temporary mismatch around a junction
//    e2
//    |
// e1---e3

function checkAnomalyStump(e1: Edge, e2: Edge, e3: Edge) {
    const shared = sharedNode(e1, e3)
    if(shared != undefined) {
        if(e2.u == shared || e2.v == shared){
            return true
        }
    }
    return false
}

// Check if two edges in a sequence are connected through a shared node

function checkForHoles(e1: Edge, e2: Edge){
    return sharedNode(e1,e2) == undefined
}

export class RideRecorder {
    bus: EventBus
    rideEdges: Map<string, Edge> = new Map()
    rideEdgeList: Edge[] = []

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
        const closestEdge = this.bus.request("routing:closestedge:pos", pos)

        if(closestEdge && !this.rideEdges.get(closestEdge.edge.edge_id)){
            if(!this.lastMatchedEdge || this.lastMatchedEdge == closestEdge.edge.edge_id){
                this.stableMatchingCounter++

                if(this.stableMatchingCounter > 2){
                    this.rideEdges.set(closestEdge.edge.edge_id, closestEdge.edge)
                    this.rideEdgeList.push(closestEdge.edge)

                    // Send message to draw on map
                    this.bus.emitEvent("map:snailtrail:add:edge", closestEdge.edge)

                    // Check for anomalies
                    //--------------------
                    const revEdges = this.rideEdgeList.toReversed()

                    // Stump edges
                    if(revEdges.length > 2 && checkAnomalyStump(revEdges[0], revEdges[1], revEdges[2])){
                        this.rideEdgeList.splice(-2, 1)
                        this.bus.emitEvent("map:snailtrail:set:edges", this.rideEdgeList)
                    }

                    // Holes
                    if(revEdges.length > 1 && checkForHoles(revEdges[0], revEdges[1])){
                        const plugEdge = this.findPlugEdge(revEdges[0], revEdges[1])
                        if(plugEdge != undefined){
                            const last = this.rideEdgeList.pop()!
                            this.rideEdgeList.push(plugEdge)
                            this.rideEdgeList.push(last)
                            this.bus.emitEvent("map:snailtrail:set:edges", this.rideEdgeList)
                        }else{
                            this.bus.emitEvent("notification:show",{
                                type: NotificationType.WARNING,
                                caption: "Ride Recorder Anomaly",
                                description: `Could not plug <b>hole</b>`,
                                autocloseDelay: undefined
                            })
                        }
                    }
                }
            }else
                this.stableMatchingCounter = 0

            this.lastMatchedEdge = closestEdge.edge.edge_id
        }
    }

    findPlugEdge(e1: Edge, e2: Edge) {
        const adjU = this.bus.request("node:adjacency", NodeId(e1.u)) ?? []
        const adjV = this.bus.request("node:adjacency", NodeId(e1.v)) ?? []
        const allNeighbours = [...adjU, ...adjV].map(adj => adj.edge)

        const f = (node: NodeId, edges: Edge[]) => {
            for(const e of edges){
                if(e.u == node || e.v == node)
                    return e
            }
            return undefined
        }

        return f(NodeId(e2.u), allNeighbours) || f(NodeId(e2.v), allNeighbours)
    }

}