import {EdgeGrid} from "./gridindex.ts";
import type {AdjacencyInfo, BoundingBox, Cartesian, Edge} from "./models.ts";
import {mapGeoJsonRoutingEdge} from "./mapping.ts";
import {CartesianProjection, logError} from "./helpers.ts";
import type {GeoJsonRoutingollection} from "./geo.ts";
import {bbCenter} from "./latlonmath.ts";

export class RoutingEngine{
    regionBB: BoundingBox

    edgeGridIndex!: EdgeGrid
    routingGeoData!: GeoJsonRoutingollection
    routingEdges: Edge[] = []
    nodesAdjacency: Map<number, AdjacencyInfo[]> = new Map()

    constructor(regionBB: BoundingBox) {
        this.regionBB = regionBB
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
}