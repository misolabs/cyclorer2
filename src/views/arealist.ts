import "../css/arealist.css"
import type {AreaFinder} from "../routing/areafinder.ts";
import type {Area} from "../models/models.ts";
import * as L from "leaflet";

const list = document.getElementById("area-view")!

function addItem(area: Area) {
    const item = document.createElement("div")
    item.className = "area-list-item"
    item.id = "area-item-" + area.area_id
    item.innerHTML = `
        <div>
            <strong>${area.area_id}</strong>
            <br>${area.totalLength.toFixed(0)}m
            <br>${area.nodes.length} entrypoints
        </div>
        <div>
            <div class="btn btn-danger">Show on map</div>
            <div class="btn btn-outline-dark">Navigate</div>
        </div>`

    list.appendChild(item)
    return item.id
}

export function initAreaView(areaFinder: AreaFinder){
    for(const area of areaFinder.areaData.values()){
        const elId = addItem(area)
        const map = L.map(elId, {attributionControl: false, zoomControl: false, rotateControl: false, scrollWheelZoom: false})
        const layer = L.geoJSON(area.geoData, {style: {color: "lightseagreen", weight: 1}}).addTo(map)
        map.fitBounds(layer.getBounds())
    }
}