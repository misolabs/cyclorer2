import type {EventBus} from "../eventbus.ts";
import type {Settings} from "../services/settingsservice.ts";

export class DebugOverlay{
    bus: EventBus
    debugEl: HTMLElement | null

    constructor(elName: string, bus: EventBus) {
        this.bus = bus
        this.debugEl = document.getElementById(elName)

        bus.onEvent("debug:log", this.onDebugLog.bind(this))
        bus.onEvent("debug:clear", this.onDebugClear.bind(this))
        bus.onEvent("settings:loaded", this.onSettingsChanged.bind(this))
        bus.onEvent("settings:updated", this.onSettingsChanged.bind(this))
    }

    onDebugLog(contents: string){
        if(!this.debugEl) return
        this.debugEl.textContent += contents
    }

    onDebugClear(){
        if(!this.debugEl) return
        this.debugEl.textContent = '';
    }

    onSettingsChanged(s: Settings){
        if(!this.debugEl) return
        this.debugEl.style.visibility = s.showDebugOverlay ? "visible" : "hidden";
    }
}