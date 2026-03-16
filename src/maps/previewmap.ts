import * as L from "leaflet";
import type {Area} from "../models/models.ts";
import {LatLng} from "leaflet";

// TODO - Clean-up, preview should not know tracking-map
const trackingContainer = document.getElementById("tracking-map")!
const previewContainer = document.getElementById("preview-map")!

document.getElementById("preview-minimise")!.addEventListener("click", () => {
    if(previewContainer.classList.contains("minipreview")) {
        previewContainer.classList.remove("minipreview")
        trackingContainer.classList.remove("minipreview")
    }
    else {
        previewContainer.classList.add("minipreview")
        trackingContainer.classList.add("minipreview")
    }
    window.dispatchEvent(new CustomEvent("invalidateMap", {}))
})

export class PreviewMap {
    map: L.Map
    previewArea: L.GeoJSON

    constructor(elName: string) {
        this.map = L.map(elName, {
            zoomControl: false,
            attributionControl: false,
            rotateControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false})
        this.previewArea = L.geoJSON([], {style: {color: "lightseagreen", weight: 3}}).addTo(this.map)
    }

    setArea(area: Area){
        this.previewArea.clearLayers()
        this.previewArea.addData(area.geoData)
        this.map.fitBounds(this.previewArea.getBounds())
    }

    clearArea(){
        this.previewArea.clearLayers()
    }
}
