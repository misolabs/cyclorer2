import * as L from "leaflet";
import {LatLng} from "leaflet";
import type {EventBus} from "../eventbus.ts";
import type {NodeId} from "../models/models.ts";

export class JunctionMap {
    bus: EventBus
    map: L.Map

    constructor(elName: string, bus: EventBus) {
        this.bus = bus

        this.map = L.map(elName, {
            zoomControl: false,
            attributionControl: false,
            rotateControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false
        })
    }

    showJunctionMap(node: NodeId){
        // Get node neighbours from routing engine
    }
}