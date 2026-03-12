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
            <div class="btn btn-primary mb-2 highlight-area">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-map" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.5.5 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103M10 1.91l-4-.8v12.98l4 .8zm1 12.98 4-.8V1.11l-4 .8zm-6-.8V1.11l-4 .8v12.98z"/>
                </svg>
            </div>
            <div class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-crosshair" viewBox="0 0 16 16">
                <path d="M8.5.5a.5.5 0 0 0-1 0v.518A7 7 0 0 0 1.018 7.5H.5a.5.5 0 0 0 0 1h.518A7 7 0 0 0 7.5 14.982v.518a.5.5 0 0 0 1 0v-.518A7 7 0 0 0 14.982 8.5h.518a.5.5 0 0 0 0-1h-.518A7 7 0 0 0 8.5 1.018zm-6.48 7A6 6 0 0 1 7.5 2.02v.48a.5.5 0 0 0 1 0v-.48a6 6 0 0 1 5.48 5.48h-.48a.5.5 0 0 0 0 1h.48a6 6 0 0 1-5.48 5.48v-.48a.5.5 0 0 0-1 0v.48A6 6 0 0 1 2.02 8.5h.48a.5.5 0 0 0 0-1zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>
                </svg>
            </div>
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