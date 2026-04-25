import type {EventBus} from "../eventbus.ts";
import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "../models/geo.ts";
import type {NotificationData} from "../models/models.ts";
import {logError} from "../helpers.ts";
import {mapGeoArea} from "../models/mapping.ts";

export class RoutingDataService{
    bus: EventBus

    statsData: RoutingStatsJson|undefined
    routingGeoData!: GeoJsonRoutingollection
    areaGeoData!: GeoJsonAreaCollection
    entrypointsGeoData!: GeoJsonEntrypointCollection

    constructor(bus: EventBus) {
        this.bus = bus

        this.statsData = undefined
    }

    private async loadRoutingStats(url: string): Promise<RoutingStatsJson|undefined> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");
            return await response.json();
        } catch (err) {
            console.error("Failed to load Stats json:", err);
            return undefined
        }
    }

    private async loadRoutingEdges(url: string) {
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

    private async loadAreas(url: string) {
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
    private async loadEntrypoints(url: string) {
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

    async loadRegionData(id: string) {
        // Base path with folders for different regions
        const basePath = import.meta.env.BASE_URL + `data/${id}/`

        // Load basic region stats file
        const statsData = await this.loadRoutingStats(basePath + "stats.json")
        statsData ? this.bus.emitEvent("rds:stats:loaded", statsData) : this.notifyLoadError("Error loading stats file.")

        // Load routing network
        await this.loadRoutingEdges(basePath + "routing_edges.geojson")
        this.routingGeoData ? this.bus.emitEvent("rds:routing:loaded", this.routingGeoData) : this.notifyLoadError("Error loading routing network")

        // Load unviisted areas
        await Promise.all([
            this.loadAreas(basePath + "unvisited_areas.geojson"),
            this.loadEntrypoints(basePath + "unvisited_junctions.geojson")
        ])
        this.areaGeoData ? this.bus.emitEvent("rds:areas:loaded", [this.areaGeoData, this.entrypointsGeoData]) : this.notifyLoadError("Error loading area data")

        console.log("Loading data done.")
    }

    private notifyLoadError(description: string) {
        this.bus.emitEvent("rds:loaderror", description)
        const notification: NotificationData = {
            type: "ERROR",
            caption: "Failed to load region data",
            description,
        }
        this.bus.emitEvent("notification:show", notification)
    }
}
