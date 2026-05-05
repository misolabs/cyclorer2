import type {EventBus} from "../eventbus.ts";
import {JunctionMap} from "../maps/junctionmap.ts";

export class PowersaveView {
    bus: EventBus

    view = document.getElementById("powersave-view")!
    preview!: JunctionMap

    constructor(bus: EventBus) {
        this.bus = bus

        bus.onEvent("powersave:enable", this.showView.bind(this))

        this.view.addEventListener("click", () => {
            bus.emitEvent("powersave:disable")
            this.hideView()
        })

        this.preview = new JunctionMap("powersave-junction-preview", this.bus)
    }

    showView(){
        this.view.classList.remove("hidden")
    }

    hideView() {
        // Fade-out splash screen
        this.view.classList.add("hidden");
    }
}