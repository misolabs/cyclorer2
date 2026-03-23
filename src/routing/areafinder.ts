import {logError} from "../helpers.ts";
import type {GeoJsonAreaCollection, GeoJsonEntrypoint, GeoJsonEntrypointCollection} from "../models/geo.ts";
import {GridIndex, NodeGrid} from "./gridindex.ts";
import type {Area, AreaNode, BoundingBox, LatLon} from "../models/models.ts";
import {mapGeoArea, mapGeoAreaNode} from "../models/mapping.ts";

const GRID_RESOLUTION: number = 0.001
const NEIGHBOURHOOD = 2

export class AreaFinder{
    areaGeoData!: GeoJsonAreaCollection
    entrypointsGeoData!: GeoJsonEntrypointCollection

    areaData: Map<number, Area> = new Map()

    grid: NodeGrid<AreaNode>

    constructor(regionBB: BoundingBox) {
        this.grid = new NodeGrid<AreaNode>(regionBB, GRID_RESOLUTION)
    }

    init(areaData: GeoJsonAreaCollection, entrypointsData: GeoJsonEntrypointCollection) {
        this.entrypointsGeoData = entrypointsData
        this.areaGeoData = areaData

        // Store areas in map for easy retrieval
        for(const geoArea of this.areaGeoData.features){
            const area = mapGeoArea(geoArea)
            this.areaData.set(area.areaId, area)
        }

        if(this.entrypointsGeoData && this.areaGeoData) {
            // Build spatial index
            for(const geoNode of this.entrypointsGeoData.features){
                const node = mapGeoAreaNode(geoNode)
                this.areaData.get(node.area_id)?.nodes.push(node)
                this.grid.addFeature(node)
            }
            console.log("Area Finder initialised")
        }
        else console.error("Error loading area or entrypoint data")
    }

    findNeighbours(pos: LatLon): AreaNode[]{
        return this.grid.findNeighbours(pos, NEIGHBOURHOOD)
    }

    areaInfoById(areaId: number): Area {
        const area = this.areaData.get(areaId)
        if(area)
            return area
        else throw new Error("Area not found")
    }
}