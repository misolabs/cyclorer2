import type {EventBus} from "../eventbus.ts";
import type {Settings} from "../services/settingsservice.ts";
import type {TileCacheStats} from "../sw.ts";

export class SettingsView {
    bus: EventBus

    settingsPane: HTMLElement
    deadendsInput: HTMLInputElement
    showAreaBoundingBox: HTMLInputElement
    showDebugOverlay: HTMLInputElement
    showDebugNotifications: HTMLInputElement
    showFreqHeatmapOverlay: HTMLInputElement
    toggleOverlaysWhenRiding: HTMLInputElement
    annotationRequestQueueSize: HTMLElement
    gpsUpdateCountElem: HTMLElement

    constructor(element: string, bus: EventBus) {
        this.bus = bus

        this.settingsPane = document.getElementById(element)!
        this.deadendsInput = document.getElementById("settings-deadends")! as HTMLInputElement
        this.showAreaBoundingBox = document.getElementById("settings-area-bbox")! as HTMLInputElement
        this.showDebugOverlay = document.getElementById("settings-show-debug")! as HTMLInputElement
        this.showDebugNotifications = document.getElementById("settings-show-debug-notifications")! as HTMLInputElement
        this.showFreqHeatmapOverlay = document.getElementById("settings-frequency-heatmap")! as HTMLInputElement
        this.toggleOverlaysWhenRiding = document.getElementById("settings-toggle-overlays")! as HTMLInputElement
        this.annotationRequestQueueSize = document.getElementById("annotation-request-queue-size")!
        this.gpsUpdateCountElem = document.getElementById("gps-update-count")!

        document.getElementById("settings-close-btn")?.addEventListener("click", this.closeListener.bind(this))
        document.getElementById("sync-data-btn")?.addEventListener("click", () => this.bus.emitEvent("data:sync"))
        document.getElementById("clear-cache-btn")?.addEventListener("click", () => {
            this.bus.emitEvent("cache:clear")
            this.bus.emitEvent("cache:stats:request")
        })

        this.bus.onEvent("settings:loaded", this.init.bind(this))
        this.bus.onEvent("settings:show", this.show.bind(this))

        this.bus.onEvent("cache:stats", this.onCacheStatsUpdated.bind(this))
    }

    init(settings: Settings): void {
        this.deadendsInput.checked = settings.showDeadends
        this.showAreaBoundingBox.checked = settings.showAreaBBox
        this.showDebugOverlay.checked = settings.showDebugOverlay
        this.showDebugNotifications.checked = settings.showDebugNotifications
        this.showFreqHeatmapOverlay.checked = settings.showFrequencyHeatmap
        this.toggleOverlaysWhenRiding.checked = settings.toggleOverlaysWhenRiding
        this.applyRadioSelection("mapService", settings.tileService)
        this.updateAnnotationQueueSize()
    }

    show(show: boolean) {
        this.settingsPane.style.visibility = show ? "visible" : "hidden"

        // Ask for updated stats
        if(show) {
            this.bus.emitEvent("cache:stats:request")
            this.updateAnnotationQueueSize()
            this.updateGpsUpdateCount()
        }
    }

    private updateGpsUpdateCount() {
        const result = this.bus.request("geolocation:updates:count")
        this.gpsUpdateCountElem.textContent = String(result ?? 0)
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
            showDebugNotifications: this.showDebugNotifications.checked,
            toggleOverlaysWhenRiding: this.toggleOverlaysWhenRiding.checked,
            tileService: this.getSelectedRadio("mapService") ?? "osm"
        }

        // Spread the good news
        this.bus.emitEvent("settings:updated", settings)
        this.bus.emitEvent("notification:show", {
            type: "SUCCESS",
            caption: "Settings saved",
            description: "Your map preferences were updated.",
            autocloseDelay: 2500,
        })
        this.bus.emitEvent("notification:show", {
            type: "DEBUG",
            caption: "Debug notifications",
            description: settings.showDebugNotifications
                ? "Debug notifications are enabled."
                : "Debug notifications are disabled.",
            autocloseDelay: 2500,
        })
    }

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

    private updateAnnotationQueueSize() {
        const result = this.bus.request("annotations:requests:queuesize")
        this.annotationRequestQueueSize.textContent = String(result ?? 0)
    }
}
