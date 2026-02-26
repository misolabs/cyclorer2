import {logError} from "../helpers.ts";
import type {GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection} from "../models/geo.ts";
import {GridIndex, NodeGrid} from "./gridindex.ts";
import type {Area, AreaNode, BoundingBox, LatLon} from "../models/models.ts";
import {mapGeoArea, mapGeoAreaNode} from "../models/mapping.ts";

export class AreaFinder{
    areaGeoData!: GeoJsonAreaCollection
    entrypointsGeoData!: GeoJsonEntrypointCollection

    areaData: Map<number, Area> = new Map()

    grid: NodeGrid<AreaNode>

    constructor(regionBB: BoundingBox) {
        this.grid = new NodeGrid<AreaNode>(regionBB, 0.005)
    }

    async init(){
        // Areas and entrypoints
        await Promise.all([
            this.loadAreas(import.meta.env.BASE_URL + "data/unvisited_areas.geojson"),
            this.loadEntrypoints(import.meta.env.BASE_URL + "data/unvisited_junctions.geojson")
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

            // Store areas in map for easy retrieval
            for(const geoArea of this.areaGeoData.features){
                const area = mapGeoArea(geoArea)
                this.areaData.set(area.area_id, area)
            }

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

    areaInfoById(areaId: number): Area {
        const area = this.areaData.get(areaId)
        if(area)
            return area
        else throw new Error("Area not found")
    }
}