import * as L from "leaflet";
import type {Area} from "../models/models.ts";
import {LatLng} from "leaflet";

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
