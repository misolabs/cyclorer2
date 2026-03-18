import * as L from "leaflet";
import type {Area, LatLon} from "../models/models.ts";
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
    areaId: number|null = null
    map: L.Map
    previewArea: L.GeoJSON
    entrypointsLG: L.LayerGroup
    positionMarker: L.CircleMarker

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
        this.entrypointsLG = L.layerGroup().addTo(this.map)
        this.positionMarker = L.circleMarker(new LatLng(0,0), {radius: 6, color: "red", fillColor: "red", fillOpacity: 0.5})
    }

    setArea(area: Area) {
        if (this.areaId == null || area.area_id != this.areaId) {
            this.areaId = area.area_id

            // path network
            this.previewArea.clearLayers()
            this.previewArea.addData(area.geoData)
            this.map.fitBounds(this.previewArea.getBounds())

            // entrypoints
            area.nodes.forEach(node => {
                L.circleMarker(new LatLng(node.position.lat, node.position.lon), {
                    radius: 5,
                    color: "orange",
                    fillColor: "lightseagreen",
                    fillOpacity: 1.0,
                }).addTo(this.entrypointsLG)
            })
        }
    }

    clearArea(){
        this.areaId = null
        this.previewArea.clearLayers()
        this.entrypointsLG.clearLayers()
        this.positionMarker.remove()
    }

    setPosition(pos: LatLon){
        if(this.areaId != null)
            this.positionMarker.setLatLng(new LatLng(pos.lat, pos.lon)).addTo(this.map)
    }
}
