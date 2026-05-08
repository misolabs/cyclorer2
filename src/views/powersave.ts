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
        bus.onEvent("geolocation:update", (p: GeolocationPosition) => this.previewMap.setPositionMarker({lat: p.coords.latitude, lon: p.coords.longitude}))

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
        const mapContainerEl = document.getElementById("powersave-junction-container")!
        const adj: AdjacencyInfo[] | undefined = this.bus.request("node:adjacency", junction.nodeId)

        //this.previewMap.showJunctionMap(junction.pos)
        //mapContainerEl.classList.remove("hide")

        mapContainerEl.classList.add("hide")
        if(adj && adj.length > 2){
            let unvisited = false
            for(const node of adj){
                const annotation = this.bus.request("annotations:edge:get", node.edge.edge_id)
                if(annotation)
                    unvisited = true

                if((node.edge.ride_count == 0 || node.edge.deadend) && node.edge.offroad)
                    unvisited = true
            }
            if(unvisited){

                mapContainerEl.classList.remove("hide")
                this.previewMap.showJunctionMap(junction.pos)
                //this.previewMap.rotateMap(junction.orientation)
                this.previewMap.map.invalidateSize(true)

                this.bus.emitEvent("notification:show",{
                    type: NotificationType.DEBUG,
                    caption: `Showing junction`,
                    description: `${mapContainerEl.classList.toString()}`,
                    autocloseDelay: 3000
                })
            }
        }
    }
}