export interface Settings{
    showDeadends: boolean
    showAreaBBox: boolean
    showDebugOverlay: boolean
}

let settingsPane: HTMLElement
let deadendsInput: HTMLInputElement
let showAreaBoundingBox: HTMLInputElement
let showDebugOverlay: HTMLInputElement

let listener: ((s: Settings) => void) | null

export function settingsInit(element: string, l: ((s: Settings) => void) | null) {
    settingsPane = document.getElementById(element)!
    listener = l

    document.getElementById("settings-close")?.addEventListener("click", settingsCloseListener)
    deadendsInput = document.getElementById("settings-deadends")! as HTMLInputElement
    showAreaBoundingBox = document.getElementById("settings-area-bbox")! as HTMLInputElement
    showDebugOverlay = document.getElementById("settings-show-debug")! as HTMLInputElement

    const storedSettings = loadSettings()
    deadendsInput.checked = storedSettings.showAreaBBox
    showAreaBoundingBox.checked = storedSettings.showAreaBBox
    showDebugOverlay.checked = storedSettings.showDebugOverlay

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
        showDebugOverlay: showDebugOverlay.checked,
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
    showDebugOverlay: false,
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