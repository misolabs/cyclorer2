import type {EventBus} from "../eventbus.ts";
import type {Settings} from "../services/settingsservice.ts";
import type {TileCacheStats} from "../sw.ts";

export class SettingsView {
    bus: EventBus

    settingsPane: HTMLElement
    deadendsInput: HTMLInputElement
    showAreaBoundingBox: HTMLInputElement
    showDebugOverlay: HTMLInputElement
    showFreqHeatmapOverlay: HTMLInputElement
    toggleOverlaysWhenRiding: HTMLInputElement

    constructor(element: string, bus: EventBus) {
        this.bus = bus

        this.settingsPane = document.getElementById(element)!
        this.deadendsInput = document.getElementById("settings-deadends")! as HTMLInputElement
        this.showAreaBoundingBox = document.getElementById("settings-area-bbox")! as HTMLInputElement
        this.showDebugOverlay = document.getElementById("settings-show-debug")! as HTMLInputElement
        this.showFreqHeatmapOverlay = document.getElementById("settings-frequency-heatmap")! as HTMLInputElement
        this.toggleOverlaysWhenRiding = document.getElementById("settings-toggle-overlays")! as HTMLInputElement

        document.getElementById("settings-close-btn")?.addEventListener("click", this.closeListener.bind(this))
        document.getElementById("sync-data-btn")?.addEventListener("click", () => this.bus.emit("data:sync"))
        document.getElementById("clear-cache-btn")?.addEventListener("click", () => {
            this.bus.emit("cache:clear")
            this.bus.emit("cache:stats:request")
        })

        this.bus.on("settings:loaded", this.init.bind(this))
        this.bus.on("settings:show", this.show.bind(this))

        this.bus.on("cache:stats", this.onCacheStatsUpdated.bind(this))
    }

    init(settings: Settings): void {
        this.deadendsInput.checked = settings.showDeadends
        this.showAreaBoundingBox.checked = settings.showAreaBBox
        this.showDebugOverlay.checked = settings.showDebugOverlay
        this.showFreqHeatmapOverlay.checked = settings.showFrequencyHeatmap
        this.toggleOverlaysWhenRiding.checked = settings.toggleOverlaysWhenRiding
        this.applyRadioSelection("mapService", settings.tileService)
    }

    show(show: boolean) {
        this.settingsPane.style.visibility = show ? "visible" : "hidden"

        // Ask for updated stats
        if(show)
            this.bus.emit("cache:stats:request")
    }

    onCacheStatsUpdated(stats: TileCacheStats): void {
        const text = `
            <strong>Tile cache:</strong> ${stats.tilesCache}<br>
            <strong>Offline cache: </strong> ${stats.offlineCache}<br>
            <strong>Cache hits:</strong> ${stats.tilesCacheHits} / ${stats.offlineCacheHits}`
        document.getElementById("cache-stats")!.innerHTML = text
    }

    closeListener(event: MouseEvent) {
        // Hide settings view
        this.show(false)

        // Extract settings from UI elements
        const settings: Settings = {
            showDeadends: this.deadendsInput.checked,
            showAreaBBox: this.showAreaBoundingBox.checked,
            showFrequencyHeatmap: this.showFreqHeatmapOverlay.checked,
            showDebugOverlay: this.showDebugOverlay.checked,
            toggleOverlaysWhenRiding: this.toggleOverlaysWhenRiding.checked,
            tileService: this.getSelectedRadio("mapService") ?? "osm"
        }

        // Spread the good news
        this.bus.emit("settings:updated", settings)
        this.bus.emit("notification:show", {
            type: "SUCCESS",
            caption: "Settings saved",
            description: "Your map preferences were updated.",
            autocloseDelay: 2500,
        })
    }

    // TODO - Re-Integrate AreaList on click on "Navigate to area" button

    // HELPERS
    //--------

    private getSelectedRadio(groupName: string): string | null {
        const selected = document.querySelector<HTMLInputElement>(
            `input[name="${groupName}"]:checked`
        )
        return selected ? selected.value : null
    }

    private applyRadioSelection(groupName: string, value: string) {
        const radio = document.querySelector<HTMLInputElement>(
            `input[name="${groupName}"][value="${value}"]`
        )

        if (radio) radio.checked = true
    }
}
