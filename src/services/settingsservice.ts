import type {EventBus} from "../eventbus.ts";

export interface Settings{
    showDeadends: boolean
    showAreaBBox: boolean
    showFrequencyHeatmap: boolean
    showDebugOverlay: boolean
    toggleOverlaysWhenRiding: boolean
    tileService: string
}

const defaultSettings: Settings ={
    showDeadends: true,
    showAreaBBox: true,
    showFrequencyHeatmap: true,
    showDebugOverlay: false,
    toggleOverlaysWhenRiding: true,
    tileService: "osm"
}

const STORAGE_KEY = 'cyclorer2_settings'

export class SettingsService{
    bus: EventBus

    constructor(bus: EventBus) {
        this.bus = bus

        // Register listeners
        this.bus.on("settings:init", this.initSettings.bind(this))
        this.bus.on("settings:save", this.saveSettings.bind(this))
    }

    // LISTENERS
    //----------

    initSettings(){
        const settings = this.loadSettings()
        this.bus.emit("settings:loaded", settings)
    }

    // IMPLEMENTATION
    //---------------

    loadSettings(): Settings {
        const raw = localStorage.getItem(STORAGE_KEY)

        if (!raw) return defaultSettings

        try {
            return { ...defaultSettings, ...JSON.parse(raw) }
        } catch {
            return defaultSettings
        }
    }

    saveSettings(settings: Settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    }
}