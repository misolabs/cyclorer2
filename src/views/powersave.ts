import type {EventBus} from "../eventbus.ts";
import {JunctionMap} from "../maps/junctionmap.ts";
import {type AdjacencyInfo, type JunctionInfo, NotificationType} from "../models/models.ts";
import {isOfHighwayType} from "../helpers.ts";

export class PowersaveView {
    bus: EventBus

    view = document.getElementById("powersave-view")!
    previewMap!: JunctionMap
    alertSound: HTMLAudioElement

    constructor(bus: EventBus) {
        this.bus = bus
        this.previewMap = new JunctionMap("powersave-junction-preview", this.bus)

        bus.onEvent("powersave:enable", this.showView.bind(this))
        bus.onEvent("navigation:upcoming:junction", this.onUpcomingJunction.bind(this))

        this.view.addEventListener("click", () => {
            bus.emitEvent("powersave:disable")
            this.hideView()
        })

        this.alertSound = new Audio(`${import.meta.env.BASE_URL}assets/alert.mp3`)
    }

    showView(){
        this.view.classList.remove("hidden")
    }

    hideView() {
        // Fade-out splash screen
        this.view.classList.add("hidden");
    }

    onUpcomingJunction(junction: JunctionInfo){
        const mapContainerEl = document.getElementById("powersave-junction-container")!
        const adj: AdjacencyInfo[] | undefined = this.bus.request("node:adjacency", junction.nodeId)

        if(adj && adj.length > 2){
            let worthShowing = false
            for(const node of adj){
                const annotation = this.bus.request("annotations:edge:get", node.edge.edge_id)
                if(annotation)
                    worthShowing = true

                if((node.edge.ride_count == 0 || node.edge.deadend) && isOfHighwayType(node.edge.highway, "path", "track"))
                    worthShowing = true
            }
            if(worthShowing){
                mapContainerEl.classList.remove("hide")
                this.previewMap.map.invalidateSize(true)
                this.previewMap.showJunctionExt(junction)

                // Play audio cue
                this.alertSound.currentTime = 0
                this.alertSound.play().catch((reason) => {
                    this.bus.emitEvent("notification:show", {
                        type: NotificationType.DEBUG,
                        caption: "Error playing audio",
                        description: reason,
                        autocloseDelay: 3000
                    })
                })
            }
            else
                mapContainerEl.classList.add("hide")
        }
    }
}