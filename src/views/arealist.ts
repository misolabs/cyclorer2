import "../css/arealist.css"
import type {AreaFinder} from "../routing/areafinder.ts";
import type {Area} from "../models/models.ts";
import * as L from "leaflet";

const list = document.getElementById("area-view")!

function selectArea(areaId: number) {
    const event = new CustomEvent("areaSelected", {
        detail: { areaId }
    })

    window.dispatchEvent(event)
    setTimeout(()=>{list.classList.add("hide-list")}, 250)
}

function addItem(area: Area) {
    const item = document.createElement("div")
    item.className = "area-list-item"
    item.id = "area-item-" + area.area_id
    item.innerHTML = `
        <div class="area-list-info">
            <strong>Area ${area.area_id}</strong>
            <br>${area.totalLength.toFixed(0)}m
            <br>${area.nodes.length} entrypoints
        </div>
        <div class="area-list-preview"></div>
        <div class="area-list-buttons">
            <div class="btn btn-danger mb-2 highlight-area">Show on map</div>
            <div class="btn btn-outline-dark">Navigate</div>
        </div>`

    // Add event listeners
    const highlightButton = item.querySelector(".highlight-area")!
    highlightButton.addEventListener("click", () => {selectArea(area.area_id)})

    const mapPreview = item.querySelector(".area-list-preview")! as HTMLDivElement

    list.appendChild(item)
    return mapPreview
}

export function initAreaView(areaFinder: AreaFinder){
    list.replaceChildren()
    list.classList.remove("hide-list")

    for(const area of areaFinder.areaData.values()){
        const elPreview = addItem(area)
        const map = L.map(elPreview, {attributionControl: false, zoomControl: false, rotateControl: false, scrollWheelZoom: false})
        const layer = L.geoJSON(area.geoData, {style: {color: "lightseagreen", weight: 1}}).addTo(map)
        map.fitBounds(layer.getBounds())
    }
}