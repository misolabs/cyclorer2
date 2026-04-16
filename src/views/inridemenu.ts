import type {EventBus} from "../eventbus.ts";
import type {Area} from "../models/models.ts";

export class InRideMenu{
    bus: EventBus
    container: HTMLElement
    mobileMode: boolean

    constructor(bus: EventBus, mobileMode: boolean) {
        this.bus = bus
        this.mobileMode = mobileMode
        this.container = document.getElementById("annotation-menu-container")!
    }

    init(){
        document.getElementById("drop-pin-danger")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "DANGER"); this.hide()})
        document.getElementById("drop-pin-explore")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "EXPLORE"); this.hide()})
        document.getElementById("drop-pin-favorite")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "FAVORITE"); this.hide()})
        document.getElementById("drop-pin-climb")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "CLIMB"); this.hide()})
        document.getElementById("drop-pin-generic")!.addEventListener("click", () => {this.bus.emit("annotation:location:marker:create", "QUICKDROP"); this.hide()})

        document.getElementById("open-annotation-menu")!.addEventListener("click", () => {
            console.log("open-annotation-menu")
            if(this.container.classList.contains("hide")){
                this.container.classList.remove("hide")
            }else this.hide()
        })

        document.getElementById("powersave-enable-btn")!.addEventListener("click", () => {this.bus.emit("powersave:enable")})

        // Some buttons are only visible in mobile or desktop mode

        const query: string = this.mobileMode ? "#buttons-overlay > button.cyc-only-desktop" : "#buttons-overlay > button.cyc-only-mobile"
        const buttonsToHide = document.querySelectorAll(query)
        //buttonsToHide.forEach(button => {button.classList.add("hide")})
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
