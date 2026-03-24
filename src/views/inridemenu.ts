import type {EventBus} from "../eventbus.ts";

export class InRideMenu{
    bus: EventBus
    container: HTMLElement

    constructor(bus: EventBus) {
        this.bus = bus
        this.container = document.getElementById("ui-midride-menu-content")!
    }

    init(){
        document.getElementById("drop-pin-danger")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "DANGER"); this.hide()})
        document.getElementById("drop-pin-explore")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "EXPLORE"); this.hide()})
        document.getElementById("drop-pin-favorite")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "FAVORITE"); this.hide()})
        document.getElementById("drop-pin-climb")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "CLIMB"); this.hide()})

        document.getElementById("open-inride-menu")!.addEventListener("click", () => {
            if(this.container.classList.contains("hide")){
                this.container.classList.remove("hide")
            }else this.hide()
        })
    }

    hide(){
        this.container.classList.add("hide")
    }
}
