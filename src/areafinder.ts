import {logError} from "./helpers.ts";
import type {GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection} from "./geo.ts";
import {GridIndex, NodeGrid} from "./gridindex.ts";
import type {AreaNode, BoundingBox, LatLon} from "./models.ts";
import {mapGeoAreaNode} from "./mapping.ts";

export class AreaFinder{
    areaGeoData!: GeoJsonAreaCollection
    entrypointsGeoData!: GeoJsonEntrypointCollection

    grid: NodeGrid<AreaNode>

    constructor(regionBB: BoundingBox) {
        this.grid = new NodeGrid<AreaNode>(regionBB)
    }

    async init(){
        // Areas and entrypoints
        await Promise.all([
            this.loadAreas("data/unvisited_areas.geojson"),
            this.loadEntrypoints("data/unvisited_junctions.geojson")
        ])
        if(this.entrypointsGeoData && this.areaGeoData) {
            // Build spatial index
            for(const geoNode of this.entrypointsGeoData.features){
                const node = mapGeoAreaNode(geoNode)
                this.grid.addFeature(node)
            }
            console.log("Area Finder initialised")
        }
        else console.error("Error loading area or entrypoint data")
    }

    async loadAreas(url: string) {
        try {
            // Fetch area network data
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");
            this.areaGeoData = await response.json();
            if(this.areaGeoData)
                console.log("Areas", this.areaGeoData.features.length)
        } catch (err:unknown) {
            logError(err, "Failed to load areas:");
        }
    }
    async loadEntrypoints(url: string) {
        try {
            // Fetch area network data
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");
            this.entrypointsGeoData = await response.json();
            if(this.entrypointsGeoData)
                console.log("Entrypoints", this.entrypointsGeoData.features.length)
        } catch (err: unknown) {
            logError(err, "Error loading entry points")
        }
    }

    findNeighbours(pos: LatLon): AreaNode[]{
        return this.grid.findNeighbours(pos, 1)
    }
}