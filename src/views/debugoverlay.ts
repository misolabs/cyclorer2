import type {EventBus} from "../eventbus.ts";
import type {Settings} from "../services/settingsservice.ts";

export class DebugOverlay{
    bus: EventBus
    debugEl: HTMLElement

    constructor(elName: string, bus: EventBus) {
        this.bus = bus
        this.debugEl = document.getElementById(elName)!

        bus.on("debug:log", this.onDebugLog.bind(this))
        bus.on("debug:clear", this.onDebugClear.bind(this))
        bus.on("settings:updated", this.onSettingsChanged.bind(this))
    }

    onDebugLog(contents: string){
        this.debugEl.textContent += contents
    }

    onDebugClear(){
        this.debugEl.textContent = '';
    }

    onSettingsChanged(s: Settings){
        this.debugEl.style.visibility = s.showDebugOverlay ? "visible" : "hidden";
    }
}