import type {EventBus} from "../eventbus.ts";
import {JunctionMap} from "../maps/junctionmap.ts";
import {type AdjacencyInfo, type JunctionInfo, NotificationType} from "../models/models.ts";
import {isOfHighwayType} from "../helpers.ts";

export class PowersaveView {
    bus: EventBus

    view = document.getElementById("powersave-view")!
    previewMap!: JunctionMap

    constructor(bus: EventBus) {
        this.bus = bus
        this.previewMap = new JunctionMap("powersave-junction-preview", this.bus)

        bus.onEvent("powersave:enable", this.showView.bind(this))
        bus.onEvent("navigation:junction:upcoming", this.onUpcomingJunction.bind(this))
        bus.onEvent("navigation:junction:update", this.onUpdateJunction.bind(this))
        bus.onEvent("exploration:started", this.onExplorationStarted.bind(this))

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

    isActive(){
        return !this.view.classList.contains("hidden")
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

                // Update distance to junction
                this.displayJunctionDistance(junction.distance)

                // Play audio cue
                if(this.isActive()) {
                    this.bus.emitEvent("audio:play", "alert")
                }
            }
            else
                mapContainerEl.classList.add("hide")
        }
    }

    onUpdateJunction(junction: JunctionInfo){
        this.displayJunctionDistance(junction.distance)
    }

    // When we enter unknown territory we should see the full map
    onExplorationStarted(){
        if(!this.isActive()){
            this.bus.emitEvent("powersave:disable")
            this.hideView()
        }
    }

    // Round distances to 10m for clarity
    displayJunctionDistance(distance: number){
        const dispValue = Math.round(distance / 10) * 10
        document.getElementById("powersave-distance-junction")!.textContent = `${dispValue.toFixed(0)}m`
    }
}