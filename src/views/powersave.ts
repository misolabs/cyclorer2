import type {EventBus} from "../eventbus.ts";
import {JunctionMap} from "../maps/junctionmap.ts";
import {type AdjacencyInfo, type JunctionInfo, NotificationType} from "../models/models.ts";

export class PowersaveView {
    bus: EventBus

    view = document.getElementById("powersave-view")!
    previewMap!: JunctionMap

    constructor(bus: EventBus) {
        this.bus = bus
        this.previewMap = new JunctionMap("powersave-junction-preview", this.bus)

        bus.onEvent("powersave:enable", this.showView.bind(this))
        bus.onEvent("navigation:upcoming:junction", this.onUpcomingJunction.bind(this))
//        bus.onEvent("geolocation:update", (p: GeolocationPosition) => this.previewMap.setPositionMarker({lat: p.coords.latitude, lon: p.coords.longitude}))

        this.view.addEventListener("click", () => {
            bus.emitEvent("powersave:disable")
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

    onUpcomingJunction(junction: JunctionInfo){
        const mapContainerEl = document.getElementById("powersave-junction-container")!
        const adj: AdjacencyInfo[] | undefined = this.bus.request("node:adjacency", junction.nodeId)

        /*
        mapContainerEl.classList.remove("hide")
        this.previewMap.map.invalidateSize(false)
        this.previewMap.showJunctionMap(junction.pos)
        this.previewMap.rotateMap(junction.orientation)
*/
        if(adj && adj.length > 2){
            let worthShowing = false
            for(const node of adj){
                const annotation = this.bus.request("annotations:edge:get", node.edge.edge_id)
                if(annotation)
                    worthShowing = true

                if((node.edge.ride_count == 0 || node.edge.deadend) && node.edge.offroad)
                    worthShowing = true
            }
            if(worthShowing){
                mapContainerEl.classList.remove("hide")
                this.previewMap.map.invalidateSize(true)
                this.previewMap.showJunctionExt(junction)
//                this.previewMap.rotateMap(junction.orientation)
            }
            else
                mapContainerEl.classList.add("hide")
        }
    }
}