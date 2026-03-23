import type {EventBus} from "../eventbus.ts";

export class InRideMenu{
    bus: EventBus
    container: HTMLElement

    constructor(bus: EventBus) {
        this.bus = bus
        this.container = document.getElementById("ui-midride-menu-content")!
    }

    init(){
        document.getElementById("drop-pin-danger")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "DANGER")})
        document.getElementById("drop-pin-explore")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "EXPLORE")})
        document.getElementById("drop-pin-favorite")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "FAVORITE")})
        document.getElementById("drop-pin-avoid")!.addEventListener("click", () => {this.bus.emit("annotation:location:add", "AVOID")})

        document.getElementById("open-inride-menu")!.addEventListener("click", () => {
            if(this.container.classList.contains("hide")){
                this.container.classList.remove("hide")
            }else this.container.classList.add("hide")
        })
    }
}
