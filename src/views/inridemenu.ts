import type {EventBus} from "../eventbus.ts";
import type {Area} from "../models/models.ts";

export class InRideMenu{
    bus: EventBus
    container: HTMLElement

    constructor(bus: EventBus) {
        this.bus = bus
        this.container = document.getElementById("ui-midride-menu-content")!
    }

    init(){
        document.getElementById("drop-pin-danger")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "DANGER"); this.hide()})
        document.getElementById("drop-pin-explore")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "EXPLORE"); this.hide()})
        document.getElementById("drop-pin-favorite")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "FAVORITE"); this.hide()})
        document.getElementById("drop-pin-climb")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "CLIMB"); this.hide()})

        document.getElementById("open-inride-menu")!.addEventListener("click", () => {
            if(this.container.classList.contains("hide")){
                this.container.classList.remove("hide")
            }else this.hide()
        })

        // Clicked on button to return focus to rider
        document.getElementById("zoom-frame-rider")!.addEventListener("click", () => {
            this.bus.emit("zoom:frame:rider")
            document.getElementById("zoom-frame-rider")!.classList.add("hide")
        })

        this.bus.on("zoom:framed:area", this.onZoomFramedArea.bind(this))
    }

    hide(){
        this.container.classList.add("hide")
    }

    // Show button to return focus to rider
    onZoomFramedArea(area: Area){
        const button = document.getElementById("zoom-frame-rider")!;
        button.classList.remove("hide")
    }
}
