import {EdgeGrid} from "./gridindex.ts";
import {
    type AdjacencyInfo,
    type BoundingBox,
    type Cartesian,
    type Edge,
    type EdgeIntersection,
    type LatLon, NodeId, type Route,
    TravelDirection
} from "../models/models.ts";

import {mapGeoJsonRoutingEdge} from "../models/mapping.ts";
import {CartesianProjection, logError} from "../helpers.ts";
import type {GeoJsonRoutingollection} from "../models/geo.ts";
import {bbCenter} from "../crs/latlonmath.ts";
import {pointToSegmentDistance} from "../crs/cartesian.ts";

const GRID_RESOLUTION: number = 0.001
const NEIGHBOURHOOD = 2

export class RoutingEngine{
    regionBB: BoundingBox
    projection: CartesianProjection

    edgeGridIndex!: EdgeGrid
    routingGeoData!: GeoJsonRoutingollection
    routingEdges: Edge[] = []
    nodesAdjacency: Map<NodeId, AdjacencyInfo[]> = new Map()

    // Initialisation
    //===============

    constructor(regionBB: BoundingBox) {
        this.regionBB = regionBB
        this.projection = new CartesianProjection(bbCenter(regionBB))
    }

    addToAdjacency(edge: Edge):void{
        // Add edge to adjacency map
        const u = NodeId(edge.u)
        const v = NodeId(edge.v)

        if(!this.nodesAdjacency.get(u))
            this.nodesAdjacency.set(u, [])
        this.nodesAdjacency.get(u)?.push({node: v, distance: edge.length, edge:edge})

        if(!this.nodesAdjacency.get(v))
            this.nodesAdjacency.set(v, [])
        this.nodesAdjacency.get(v)?.push({node: u, distance: edge.length, edge:edge})
    }

    async loadRoutingEdges(url: string) {
        try {
            // Fetch area network data
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");
            this.routingGeoData = await response.json();
            console.log("Routing edges", this.routingGeoData.features.length)
        } catch (err: unknown) {
            logError(err, "Failed to load routing edges:");
        }
    }

    buildDataStructures(){
        // Create grid
        this.edgeGridIndex  = new EdgeGrid(this.regionBB, GRID_RESOLUTION)

        // Add edges to grid index
        for(const geoEdge of this.routingGeoData.features){
            // Map to domain
            const edge:Edge = mapGeoJsonRoutingEdge(geoEdge)

            // Precompute cartesian coordinates
            const center= bbCenter(this.regionBB)
            const projector = new CartesianProjection(center)
            const cartesian: Cartesian[] = []
            for(const p of edge.coordinates){
                const pXY = projector.fromLatlon(p)
                cartesian.push(pXY)
            }
            edge.cartesian = cartesian

            // Add to edge list
            this.routingEdges.push(edge)

            // Add to spatial grid index for fast lookup
            this.edgeGridIndex.addFeature(edge)

            // Add to adjacency graph if not a deadend
            if(!edge.deadend)
                this.addToAdjacency(edge)
        }
    }

    async init(){
        await this.loadRoutingEdges(import.meta.env.BASE_URL + "data/routing_edges.geojson")
        this.buildDataStructures()
    }

    // Find closest edge
    //==================

    findClosestEdge(pos: LatLon): EdgeIntersection|undefined{
        const pTracking = this.projection.fromLatlon(pos)

        let closestEdge:Edge|null = null
        let minDist:number = Infinity
        let segmentIndex!:number
        let segmentT!:number

        const candidates = this.edgeGridIndex.findNeighbours(pos, NEIGHBOURHOOD)
        for(const e of candidates){
            //console.log("Candidate", e.osmid)
            const pointsXY = e.cartesian

            if(pointsXY) {
                // geometry is in order lon, lat
                let pLast = pointsXY[0]
                //console.log("Edge segments", pointsXY.length - 1)
                for (let i = 1; i < pointsXY.length; i++) {
                    const {distance: distanceToSegment, t} = pointToSegmentDistance(pTracking, pointsXY[i], pLast)
                    if (distanceToSegment < minDist && t >= 0 && t <= 1) {
                        minDist = distanceToSegment
                        closestEdge = e
                        segmentIndex = i - 1
                        segmentT = t
                        //console.log("Closest point", minDist)
                        //console.log("Segment index", segmentIndex)
                        //console.log("Segement t", segmentT)
                    }
                    pLast = pointsXY[i]
                }
            }
        }
        if(!closestEdge) return undefined

        return {
            edge: closestEdge,
            segmentIndex: segmentIndex,
            t: segmentT,
            distance: minDist,
        }
    }

    travelDirection(pos: LatLon, headingPos: LatLon, closestEdge: EdgeIntersection):TravelDirection{
        // Dot product of direction of travel and current edge segment from u to v
        // positive = same general direction
        const pXY = this.projection.fromLatlon(pos)
        const pHeading = this.projection.fromLatlon(headingPos)
        const vH: Cartesian = {x: pHeading.x - pXY.x, y: pHeading.y - pXY.y}
        const lH = Math.sqrt(vH.x * vH.x + vH.y * vH.y)


        const su = closestEdge.edge.cartesian[closestEdge.segmentIndex]
        const sv = closestEdge.edge.cartesian[closestEdge.segmentIndex + 1]
        const vUV: Cartesian = {x: sv.x -su.x, y: sv.y - su.y}

        const dot = (vH.x * vUV.x + vH.y * vUV.y) / lH
        return dot > 0 ? TravelDirection.U_TO_V : TravelDirection.V_TO_U
    }

    travelDirectionVector(vH: Cartesian|null, closestEdge: EdgeIntersection):TravelDirection|undefined{
        if(!vH)
            return undefined

        // Dot product of direction of travel and current edge segment from u to v
        // positive = same general direction
        const lH = Math.sqrt(vH.x * vH.x + vH.y * vH.y)

        const su = closestEdge.edge.cartesian[closestEdge.segmentIndex]
        const sv = closestEdge.edge.cartesian[closestEdge.segmentIndex + 1]
        const vUV: Cartesian = {x: sv.x -su.x, y: sv.y - su.y}

        const dot = (vH.x * vUV.x + vH.y * vUV.y) / lH
        return dot > 0 ? TravelDirection.U_TO_V : TravelDirection.V_TO_U
    }
    // Dijkstra route finding
    //=======================

    // Use Map of "Best predecessor for x" to walk back to starting node from target
    // Result is a list of node ids
    reconstructPath(prev: Map<NodeId, NodeId>, target: NodeId): NodeId[]|null {
        const path = [];
        let current: NodeId|undefined = target;

        // If target was never reached
        if (!prev.has(current)) {
            //console.log("Target not reached", prev.keys())
            return null; // or []
        }

        while (current !== undefined) {
            path.push(current);
            current = prev.get(current);
        }

        path.reverse();
        console.log("Reconstructed path", path)
        return path;
    }

    dijkstra(start: NodeId, target: NodeId): NodeId[]|null {
        if(start == target) return []

        const dist = new Map<NodeId, number>(); // Distances from starting node to node x
        const prev = new Map<NodeId, NodeId>(); // Best predecessor for node x
        const visited = new Set<NodeId>();

        // Init: Put starting node in queue
        dist.set(start, 0);
        const queue = [start];

        while (queue.length > 0) {

            // Find node u in queue with smallest distance
            let u = null;
            let best = Infinity;

            for (const n of queue) {
                const d = dist.get(n)
                if (d != undefined && d < best) {
                    best = d;
                    u = n;
                }
            }

            if(u != null) {
                //console.log("Candidate", u)
                // Remove best candidate u from queue
                queue.splice(queue.indexOf(u), 1);

                if (u === target) {
                    break;
                }

                visited.add(u);

                // Find all neighbours of u that we haven't visited yet
                const neighbours = this.nodesAdjacency.get(u)
                if(neighbours) {
                    for (const {node: v, distance} of neighbours) {
                        // Skip if we have been here before (avoid loops)
                        if (visited.has(v)) continue;

                        // Is this a better way to get to v?
                        const dv = dist.get(v)
                        const du = dist.get(u)
                        const alt = (du === undefined ? 0 : du) + distance;

                        if (dv === undefined || alt < dv) {
                            dist.set(v, alt);
                            prev.set(v, u);

                            if (!queue.includes(v))
                                queue.push(v);
                        }
                    }
                }
            }
        }

        return this.reconstructPath(prev, target);
    }

    nodesToEdges(routeNodes: NodeId[]): Route{
        // Collect edges and length
        let lastN = routeNodes[0]
        let totalLength = 0
        const routeEdges: Edge[] = []

        for(let i=1; i < routeNodes.length;i++){
            const currentN = routeNodes[i]
            const adj = this.nodesAdjacency.get(lastN)

            if(adj){
                let found = false
                for(const n of adj){
                    if(n.node === currentN){
                        totalLength += n.distance
                        routeEdges.push(n.edge)
                        found = true
                    }
                }
                if(!found) console.error("No edge found for nodes", lastN, currentN)
            }else console.error("No neighbours")
            lastN = currentN
        }
        return {totalLength, routeEdges}
    }

    findRoute(startNode: NodeId, targetNode: NodeId, currentEdge: Edge){
        const routeNodes = this.dijkstra(startNode, targetNode)

        if(routeNodes) {
            const route = this.nodesToEdges(routeNodes)
            if (route) {
                // Is the target ahead of us?
                route.inTravelDirection = !(route.routeEdges.length > 0 && route.routeEdges[0] === currentEdge)
                return route
            } else console.log("Could not reconstruct edges")
        }else console.log("Dijkstra found no route")

        return undefined
    }
}