import type {EventBus} from "../eventbus.ts";
import {JunctionMap} from "../maps/junctionmap.ts";
import {type AdjacencyInfo, type JunctionInfo, NotificationType} from "../models/models.ts";

export class PowersaveView {
    bus: EventBus

    view = document.getElementById("powersave-view")!
    previewMap!: JunctionMap

    constructor(bus: EventBus) {
        this.bus = bus

        bus.onEvent("powersave:enable", this.showView.bind(this))
        bus.onEvent("navigation:upcoming:junction", this.onUpcomingJunction.bind(this))

        this.view.addEventListener("click", () => {
            bus.emitEvent("powersave:disable")
            this.hideView()
        })

        this.previewMap = new JunctionMap("powersave-junction-preview", this.bus)
    }

    showView(){
        this.view.classList.remove("hidden")
    }

    hideView() {
        // Fade-out splash screen
        this.view.classList.add("hidden");
    }

    onUpcomingJunction(junction: JunctionInfo){
        const mapEl = document.getElementById("powersave-junction-preview")!
        const adj: AdjacencyInfo[] | undefined = this.bus.request("node:adjacency", junction.nodeId)

        this.bus.emitEvent("notification:show", {
            type: NotificationType.DEBUG,
            caption: "Junction",
            description: `Junction #${junction.nodeId} with ${adj?.length} adjacent edges`,
            autocloseDelay: 3000,
        })

        mapEl.classList.add("hide")
        if(adj && adj.length > 2){
            let unvisited = false
            for(const node of adj){
                if((node.edge.ride_count > 0 || node.edge.deadend) && node.edge.offroad)
                    unvisited = true
            }
            if(unvisited){
                this.previewMap.showJunctionMap(junction.pos)
                mapEl.classList.remove("hide")
            }
        }
    }
}