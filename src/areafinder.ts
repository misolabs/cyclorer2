import {logError} from "./helpers.ts";
import type {GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection} from "./geo.ts";
import {GridIndex, NodeGrid} from "./gridindex.ts";
import type {AreaNode, BoundingBox} from "./models.ts";
import {mapGeoAreaNode} from "./mapping.ts";

export class AreaFinder{
    areaData: GeoJsonAreaCollection|null = null
    entrypointsData: GeoJsonEntrypointCollection|null = null

    grid: NodeGrid

    constructor(regionBB: BoundingBox) {
        this.grid = new NodeGrid(regionBB)
    }

    async init(){
        // Areas and entrypoints
        await Promise.all([
            this.loadAreas("data/unvisited_areas.geojson"),
            this.loadEntrypoints("data/unvisited_junctions.geojson")
        ])
        if(this.entrypointsData && this.areaData) {
            // Build spatial index
            for(const geoNode of this.entrypointsData.features){
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
            this.areaData = await response.json();
            if(this.areaData)
                console.log("Areas", this.areaData.features.length)
        } catch (err:unknown) {
            logError(err, "Failed to load areas:");
        }
    }

    async loadEntrypoints(url: string) {
        try {
            // Fetch area network data
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");
            this.entrypointsData = await response.json();
            if(this.entrypointsData)
                console.log("Entrypoints", this.entrypointsData.features.length)
        } catch (err: unknown) {
            logError(err, "Error loading entry points")
        }
    }

}