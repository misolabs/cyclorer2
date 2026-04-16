import type {EventBus} from "../eventbus.ts";

export class PowersaveView {
    bus: EventBus

    view = document.getElementById("powersave-view")!

    constructor(bus: EventBus) {
        this.bus = bus

        bus.on("powersave:enable", this.showView.bind(this))

        this.view.addEventListener("click", () => {
            bus.emit("powersave:disable")
            this.hideView()
        })
    }

    showView(){
        this.view.classList.remove("hidden")
    }

    hideView() {
        // Fade-out splash screen
        this.view.classList.add("hidden");
    }
}