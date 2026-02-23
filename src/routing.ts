import {EdgeGrid} from "./gridindex.ts";
import type {AdjacencyInfo, BoundingBox, Cartesian, Edge, LatLon} from "./models.ts";
import {mapGeoJsonRoutingEdge} from "./mapping.ts";
import {CartesianProjection, logError} from "./helpers.ts";
import type {GeoJsonRoutingollection} from "./geo.ts";
import {bbCenter} from "./latlonmath.ts";
import {LineUtil} from "leaflet";
import {pointToSegmentDistance} from "./cartesian.ts";

export class RoutingEngine{
    regionBB: BoundingBox
    projection: CartesianProjection

    edgeGridIndex!: EdgeGrid
    routingGeoData!: GeoJsonRoutingollection
    routingEdges: Edge[] = []
    nodesAdjacency: Map<number, AdjacencyInfo[]> = new Map()

    // Initialisation
    //===============

    constructor(regionBB: BoundingBox) {
        this.regionBB = regionBB
        this.projection = new CartesianProjection(bbCenter(regionBB))
    }

    addToAdjacency(edge: Edge):void{
        // Add edge to adjacency map
        const u = edge.u
        const v = edge.v

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
        this.edgeGridIndex  = new EdgeGrid(this.regionBB)

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

            // Add to adjacency graph
            this.addToAdjacency(edge)
        }
    }

    async init(){
        await this.loadRoutingEdges("data/routing_edges.geojson")
        this.buildDataStructures()
    }

    // Find closest edge
    //==================

    findClosestEdge(pos: LatLon){
        const pTracking = this.projection.fromLatlon(pos)

        let closestEdge = null
        let minDist = Infinity
        let segmentIndex = undefined
        let segmentT = undefined

        const candidates = this.edgeGridIndex.findNeighbours(pos)
        for(const e of candidates){
            console.log("Candidate", e.osmid)
            const pointsXY = e.cartesian

            if(pointsXY) {
                // geometry is in order lon, lat
                let pLast = pointsXY[0]
                console.log("Edge segments", pointsXY.length - 1)
                for (let i = 1; i < pointsXY.length; i++) {
                    const {distanceToSegment, t} = pointToSegmentDistance(pTracking, pointsXY[i], pLast)
                    if (distanceToSegment < minDist && t >= 0 && t <= 1) {
                        minDist = distanceToSegment
                        closestEdge = e
                        segmentIndex = i - 1
                        segmentT = t
                    }
                    pLast = pointsXY[i]
                }
            }
            console.log("Closest point", minDist)
            console.log("Segment index", segmentIndex)
            console.log("Segement t", segmentT)
        }
        return {
            edge:closestEdge,
            segmentIndex: segmentIndex,
            segmentT: segmentT,
            distanceToEdge: minDist,
        }
    }
}