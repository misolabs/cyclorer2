import L from "leaflet"
import type {Feature, FeatureCollection, Geometry, GeoJsonProperties} from "geojson"

type TileLoadingState =
    | { status: "pending" }
    | { status: "failed"; error: Error }
    | { status: "loaded"; tile: L.Layer }

interface RemoteGeoJsonTileLayerOptions {
    tileSize: number
    urlForTile: (x: number, y: number) => string
    style: (feature?: Feature<Geometry, GeoJsonProperties>) => L.PathOptions
    onEachFeature?: (feature: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => void
}

interface TilePayload {
    data: FeatureCollection<Geometry, GeoJsonProperties>
}

function tileKey(tileX: number, tileY: number): string {
    return `${tileX}:${tileY}`
}

function tileIndexFromCenter(center: L.LatLng, tileSize: number): L.Point {
    const webMercator = L.Projection.SphericalMercator.project(center)
    return L.point(Math.floor(webMercator.x / tileSize), Math.floor(webMercator.y / tileSize))
}

export class RemoteGeoJsonTileLayer extends L.LayerGroup {
    private readonly tileSize: number
    private readonly urlForTile: (x: number, y: number) => string
    private readonly style: (feature?: Feature<Geometry, GeoJsonProperties>) => L.PathOptions
    private readonly onEachFeature?: (feature: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => void
    private readonly tiles = new Map<string, TileLoadingState>()

    private map: L.Map | null = null

    constructor(options: RemoteGeoJsonTileLayerOptions) {
        super()
        this.tileSize = options.tileSize
        this.urlForTile = options.urlForTile
        this.style = options.style
        this.onEachFeature = options.onEachFeature
    }

    override onAdd(map: L.Map): this {
        this.map = map
        super.onAdd(map)
        map.on("moveend", this.syncVisibleTile, this)
        this.syncVisibleTile()
        return this
    }

    override onRemove(map: L.Map): this {
        map.off("moveend", this.syncVisibleTile, this)
        this.map = null
        super.onRemove(map)
        return this
    }

    clearCache(): void {
        this.tiles.clear()
        this.clearLayers()
    }

    private syncVisibleTile(): void {
        if(!this.map) return

        const center = this.map.getCenter()
        const tileIndex = tileIndexFromCenter(center, this.tileSize)
        this.ensureTile(tileIndex.x, tileIndex.y)
    }

    private ensureTile(tileX: number, tileY: number): void {
        const key = tileKey(tileX, tileY)
        const state = this.tiles.get(key)

        if(state?.status === "pending" || state?.status === "loaded") {
            return
        }

        this.tiles.set(key, {status: "pending"})
        void this.loadTile(tileX, tileY, key)
    }

    private async loadTile(tileX: number, tileY: number, key: string): Promise<void> {
        try {
            const response = await fetch(this.urlForTile(tileX, tileY))
            if(!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`)
            }

            const payload = await response.json() as TilePayload
            const layer = L.geoJSON(payload.data, {
                style: this.style,
                onEachFeature: this.onEachFeature,
            })

            this.addLayer(layer)
            this.tiles.set(key, {status: "loaded", tile: layer})
        } catch (error) {
            this.tiles.set(key, {status: "failed", error: error as Error})
            console.log(error)
        }
    }
}

export type { TileLoadingState }
