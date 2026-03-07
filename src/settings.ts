export interface Settings{
    showDeadends: boolean
    showAreaBBox: boolean
    showFrequencyHeatmap: boolean
    showDebugOverlay: boolean
    tileService: string
}

let settingsPane: HTMLElement
let deadendsInput: HTMLInputElement
let showAreaBoundingBox: HTMLInputElement
let showDebugOverlay: HTMLInputElement
let showFreqHeatmapOverlay: HTMLInputElement

let listener: ((s: Settings) => void) | null

function getSelectedRadio(groupName: string): string | null {
    const selected = document.querySelector<HTMLInputElement>(
        `input[name="${groupName}"]:checked`
    )
    return selected ? selected.value : null
}

function applyRadioSelection(groupName: string, value: string) {
    const radio = document.querySelector<HTMLInputElement>(
        `input[name="${groupName}"][value="${value}"]`
    )

    if (radio) radio.checked = true
}

export function settingsInit(element: string, l: ((s: Settings) => void) | null) {
    settingsPane = document.getElementById(element)!
    listener = l

    document.getElementById("settings-close")?.addEventListener("click", settingsCloseListener)
    deadendsInput = document.getElementById("settings-deadends")! as HTMLInputElement
    showAreaBoundingBox = document.getElementById("settings-area-bbox")! as HTMLInputElement
    showDebugOverlay = document.getElementById("settings-show-debug")! as HTMLInputElement
    showFreqHeatmapOverlay = document.getElementById("settings-frequency-heatmap")! as HTMLInputElement

    const storedSettings = loadSettings()
    deadendsInput.checked = storedSettings.showAreaBBox
    showAreaBoundingBox.checked = storedSettings.showAreaBBox
    showDebugOverlay.checked = storedSettings.showDebugOverlay
    showFreqHeatmapOverlay.checked = storedSettings.showFrequencyHeatmap
    applyRadioSelection("mapService", storedSettings.tileService)

    if(listener) listener(storedSettings)
}

export function settingsShow(){
    settingsPane.style.visibility = "visible"
}

function settingsCloseListener(event:MouseEvent){
    settingsPane.style.visibility = "hidden"

    const settings: Settings={
        showDeadends: deadendsInput.checked,
        showAreaBBox: showAreaBoundingBox.checked,
        showFrequencyHeatmap: showFreqHeatmapOverlay.checked,
        showDebugOverlay: showDebugOverlay.checked,
        tileService: getSelectedRadio("mapService") ?? "osm"
    }

    // Persist in local storage
    saveSettings(settings)

    if(listener)
        listener(settings)
}

// Persistence

const defaultSettings: Settings ={
    showDeadends: true,
    showAreaBBox: true,
    showFrequencyHeatmap: true,
    showDebugOverlay: false,
    tileService: "osm"
}

const STORAGE_KEY = 'cyclorer2_settings'

export function loadSettings(): Settings {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) return defaultSettings

    try {
        return { ...defaultSettings, ...JSON.parse(raw) }
    } catch {
        return defaultSettings
    }
}

export function saveSettings(settings: Settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}