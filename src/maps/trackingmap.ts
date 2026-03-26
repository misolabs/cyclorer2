import L from 'leaflet'
import type { GeoJsonAreaCollection, GeoJsonRouting, GeoJsonRoutingollection, GeoJsonArea, GeoJsonEntrypointCollection } from "../models/geo.ts"

import type {Area, AreaNode, LatLon, LocationAnnotation, Route} from "../models/models.ts";
import {LatLng} from "leaflet";

import 'leaflet/dist/leaflet.css'

// Marker cluster plugin
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"

// Import marker images so Vite bundles them
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type {EventBus} from "../eventbus.ts";

// Fix default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
})

function popupRoutingEdge(feature: GeoJsonRouting, layer: L.Polyline){
  const html = `<table>
  <tr>
  <td>classification</td>
  <td><b>${feature.properties.highway}</b></td>
  </tr>
  <tr>
  <td>length</td>
  <td><b>${feature.properties.length.toFixed(0)}m</b></td>
  </tr>
  <tr>
  <td>u</td>
  <td><b>${feature.properties.u}</b></td>
  </tr>
  <tr>
  <td>v</td>
  <td><b>${feature.properties.v}</b></td>
  </tr>
  </table>`
  layer.bindPopup(html)
}

function navigateTo(areaId: number){
    window.dispatchEvent(new CustomEvent('cycSelectArea', {detail: { areaId }}))
}

interface TileService{
    attribution: string
    url: string
}

const osmTileService: TileService = {url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "OpenStreetMap"}
const cyclosmTileService: TileService = {url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", attribution: "CyclOSM"}
const openTopoTileService: TileService = {url: "https://c.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "OpenTopoMap"}

const tileServices:Map<string, TileService> = new Map([
    ["osm", osmTileService],
    ["cyclosm", cyclosmTileService],
    ["opentopo", openTopoTileService],
])

let currentTileService: TileService | null = null

export class TrackingMap{
    bus: EventBus

    map: L.Map
    positionMarker: L.Marker|null = null
    headingMarker: L.Marker|null = null
    neighbourMarker: L.CircleMarker[] = []
    snappedEdge: L.Polyline
    routeLayer: L.Polyline
    headingIcon: L.Icon
    positionIcon: L.Icon

    glyphIcons: Map<string, L.Icon.Glyph> = new Map()

    baseLayer: L.TileLayer | null = null
    areasLayerGroup: L.LayerGroup = L.layerGroup()
    areaBBoxLayerGroup: L.LayerGroup = L.layerGroup()
    deadendsLayerGroup: L.LayerGroup = L.layerGroup()
    freqHeatmapLayerGroup: L.LayerGroup = L.layerGroup()
    areaHighlightLG: L.LayerGroup = L.layerGroup()
    snailTrailLG: L.LayerGroup = L.layerGroup()
    annotationsLG: L.LayerGroup = L.layerGroup()

    snailTrailLayer!: L.Polyline
    snailTrailPoly: LatLng[] = []

    heading: number = 0

    constructor(elName: string, mobileMode: boolean, bus:EventBus){
        this.bus = bus
        this.map = L.map(elName, { zoomControl: !mobileMode, rotate: true, rotateControl: false })

        L.control.scale({metric: true, imperial: false}).addTo(this.map)

        // Create a custom pane on top of the path network and heatmap
        // Holds current route and markers (overlay pane is default polyline pane @ 450)
        this.map.createPane("routePane", this.map.getPane("overlayPane"))
        const el = this.map.getPane("routePane")
        if(el){
            el.style.zIndex = "460"
            el.style.pointerEvents = "none"
        }

        this.snappedEdge = L.polyline([], {color: "#ff7f00", weight: 9, pane:"routePane"}).addTo(this.map)
        this.routeLayer = L.polyline([], {color: "#ff7f00", weight: 9, pane: "routePane"}).addTo(this.map)
        this.headingIcon = new L.Icon({
            iconUrl: import.meta.env.BASE_URL + 'assets/sign-merge-right.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [16, -32],
        })
        this.positionIcon = new L.Icon({
            iconUrl: import.meta.env.BASE_URL + 'assets/pos-marker.png',
            iconSize: [48, 48],
            iconAnchor: [24, 24],
            popupAnchor: [0, 0],
        })

        // Glyph icons for annotations
        this.glyphIcons.set( "EXPLORE", new L.Icon.Glyph({glyph:"question_mark", prefix: "material-symbols-rounded", glyphColor: "white", glyphSize: "28px", markerColor: "blue"}))
        this.glyphIcons.set( "DANGER", new L.Icon.Glyph({glyph:"skull", prefix: "material-symbols-rounded", glyphColor: "white", glyphSize: "28px", markerColor: "red"}))
        this.glyphIcons.set( "FAVORITE", new L.Icon.Glyph({glyph:"favorite", prefix: "material-symbols-rounded", glyphColor: "white", glyphSize: "28px", markerColor: "green"}))
        this.glyphIcons.set( "CLIMB", new L.Icon.Glyph({glyph:"elevation", prefix: "material-symbols-rounded", glyphColor: "white", glyphSize: "28px", markerColor: "purple"}))

        // Always visible
        this.areasLayerGroup.addTo(this.map)
        this.areaHighlightLG.addTo(this.map)
        this.snailTrailLG.addTo(this.map)
        this.annotationsLG.addTo(this.map)

        // Connect to event bus
        this.bus.on("preview:minimize", this.onToggleMinimize.bind(this))
    }

    setBaseLayer(id: string){
        const ts = tileServices.get(id)
        if(ts && ts !== currentTileService){
            console.log("Setting new base layer", id)
            if(this.baseLayer) this.map.removeLayer(this.baseLayer)

            this.baseLayer = L.tileLayer(ts.url, {
                attribution: `&copy; ${ts.attribution} contributors`
            }).addTo(this.map)
            currentTileService = ts
        }
    }

    addDeadendsLayer(routingGeoData: GeoJsonRoutingollection){
        // Mark deadends with broad black lines
        L.geoJSON(routingGeoData.features, {
            filter: (feature) => {return feature.properties.deadend},
            style: {color: "black", weight: 5}
        }).addTo(this.deadendsLayerGroup)
    }

    addRoutingLayer(routingGeoData: GeoJsonRoutingollection){
        // Simply draw entrypoints as markers
        L.geoJSON(routingGeoData.features, {
            onEachFeature: popupRoutingEdge,
            style: {color: "grey", weight: 2}
        }).addTo(this.map)
    }

    addFrequencyHeatmap(routingGeoData: GeoJsonRoutingollection, maxRideCount: number){
        // Draw edges with custom color depending on ride_count
        L.geoJSON(routingGeoData.features, {
            onEachFeature: (feature: GeoJsonRouting, layer: L.Polyline) => {
                const vLog = Math.log(feature.properties.ride_count + 1) / Math.log(maxRideCount + 1)
                const vLin = feature.properties.ride_count / maxRideCount
                layer.setStyle({color: 'hsl(290, 100%, 50%)', opacity: 1 - vLog})
            },
            filter: (feature) =>
            {
                return (!feature.properties.deadend) &&
                (feature.properties.offroad) &&
                (feature.properties.ride_count > 0)
            },
            style: {color: "grey", weight: 5}
        }).addTo(this.freqHeatmapLayerGroup)
    }

    addAreaLayer(areaData: GeoJsonAreaCollection, entrypointsData: GeoJsonEntrypointCollection){
        // Draw bounding box for each area
        const features: GeoJsonArea[] = areaData.features
        for(let i=0; i < areaData.features.length;i++){
            const [minLon, minLat, maxLon, maxLat] = features[i].properties.bbox
            const bounds = L.latLngBounds(
            [minLat, minLon],
            [maxLat, maxLon]
            );

            // Bounding rectangle
            L.rectangle(bounds,{weight:1, color: (features[i].properties.total_length > 200 ? "Purple": "Blue")})
            .bindPopup(`area: <b>${features[i].properties.area_id}</b><br/>
                <div class="btn btn-danger" onclick="window.dispatchEvent(new CustomEvent('cycNavigateArea', {detail: { areaId: ${features[i].properties.area_id} }}))">Navigate</div>`
            )
            .addTo(this.areaBBoxLayerGroup)
        }
    
        // Draw edge network
        L.geoJSON(areaData.features,
            {
            style: {
            color: "red",
            weight: 3,
            opacity: 1
            }
        }).addTo(this.areasLayerGroup)
        
        // Draw entrypoints
        L.geoJSON(entrypointsData.features,{
            pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {color: "red", radius: 3, opacity:1}).bindPopup(`nodeid: <b>${feature.properties.osmid}</b>`)
            }
        }).addTo(this.areasLayerGroup)
    }

    addPositionMarker(startPos: L.LatLng, listener: ((e: L.DragEndEvent)=>void) | null){
        this.positionMarker = L.marker(startPos, {draggable: true, title: "Tracking", icon: this.positionIcon}).addTo(this.map)
        if(listener != null)
            this.positionMarker.addEventListener("dragend", listener)
    }

    addHeadingMarker(startPos: L.LatLng, listener: ((e: L.DragEndEvent)=>void) | null){
        this.headingMarker = L.marker(startPos, {
            draggable: true,
            title: "Heading",
            icon: this.headingIcon}
        ).addTo(this.map)
        if(listener != null)
            this.headingMarker.addEventListener("dragend", listener)
    }

    highlightArea(area: Area | null){
        this.areaHighlightLG.clearLayers()
        if(area){
            const areaLayer = L.geoJSON(area.geoData, {
                //filter: (feature) => {return feature.properties.area_id == area.area_id},
                style: {color: "yellow", weight: 7}
            }).addTo(this.areaHighlightLG)

            // Calculate bounds of area with current position
            const prevCenter = this.map.getCenter()
            const prevZoom = this.map.getZoom()

            // Show preview of the full route
            const extBounds = areaLayer.getBounds().extend(this.positionMarker!.getLatLng())
            this.map.fitBounds(extBounds, {padding: [50, 50]})

            // Return to current view
            setTimeout(()=>{this.map.setView(prevCenter, prevZoom)}, 5000)
        }
    }
    setAreaMarker(areas: AreaNode[]): void{
        // If we need more markers, add them
        const nMarker = this.neighbourMarker.length
        const nAreas = areas.length

        if(nMarker < nAreas){
            for(let i = 0; i < nAreas - nMarker; i++){
                const marker = L.circleMarker(
                    new LatLng(0,0),
                    {
                        radius: 7,
                        color:"green",
                        fillColor:"#fc8d59",
                        fillOpacity: 1,
                        opacity: 1
                    })
                this.map.addLayer(marker)
                this.neighbourMarker.push(marker)
            }
        // If there are too many remove some
        }else if(nMarker > nAreas){
            for(let i = 0; i < nMarker - nAreas; i++) {
                const marker = this.neighbourMarker.pop()
                if (marker)
                    this.map.removeLayer(marker)
            }
        }
        console.log("Areas", areas.length, "Marker", this.neighbourMarker.length)

        // Update position
        for(let i=0; i < this.neighbourMarker.length; i++){
            this.neighbourMarker[i].setLatLng(new LatLng(areas[i].position.lat, areas[i].position.lon))
        }
    }

    clearAreaMarker(){
        this.setAreaMarker([])
    }

    setSnappedEdge(poly: LatLon[]){
        const lfPoly = poly.map(e => new L.LatLng(e.lat, e.lon))
        this.snappedEdge.setLatLngs(lfPoly)
    }

    setRoute(route: Route){
        var poly: L.LatLng[][]=[]

        for(const edge of route.routeEdges){
            poly.push(edge.coordinates.map(e => new LatLng(e.lat, e.lon)))
        }
        this.routeLayer.setLatLngs(poly)
    }

    clearRoute(){
        this.routeLayer.setLatLngs([])
        this.snappedEdge.setLatLngs([])
    }

    setPosition(pos: LatLon, centerView: boolean){
        const leafPos = new LatLng(pos.lat, pos.lon)
        if(centerView)
            this.map.setView(leafPos)
        this.positionMarker?.setLatLng(leafPos)
    }

    setHeading(angle: number){
        const alpha = 0.9
        this.heading = this.heading * alpha + angle * (1 - alpha)
        this.heading = Math.round(this.heading / 12) * 12
        this.map.setBearing(this.heading)
    }

    addAnnotation(annotation: LocationAnnotation){
        const tsLabel = new Date(annotation.timestamp).toDateString()
        const marker = L.marker(new LatLng(annotation.location.lat,annotation.location.lon), {icon:this.glyphIcons.get(annotation.category)})
            .addTo(this.annotationsLG)

        const popupContent = document.createElement("div");

        popupContent.innerHTML = `
        <span class="roboto-font" style="font-weight: bold">
            Created: ${tsLabel}
        </span>
        <br>
        <button class="btn btn-sm btn-danger delete-btn">
            <span class="material-symbols-rounded">delete</span>
        </button>
        `

        // Attach listener AFTER DOM exists
        const btn = popupContent.querySelector(".delete-btn")!;

        btn.addEventListener("click", () => {
            this.map.removeLayer(marker)
            this.bus.emit("annotation:location:delete", annotation.id!);
        });

        marker.bindPopup(popupContent);
    }

    clearAnnotations(){
        this.annotationsLG.clearLayers()
    }

    toggleAreaBoundingBoxes(show: boolean){
        if(show) this.areaBBoxLayerGroup.addTo(this.map)
        else this.areaBBoxLayerGroup.removeFrom(this.map)
    }

    toggleDeadends(show: boolean){
        if(show) this.deadendsLayerGroup.addTo(this.map)
        else this.deadendsLayerGroup.removeFrom(this.map)
    }

    toggleFrequencyHeatmap(show: boolean){
        if(show) this.freqHeatmapLayerGroup.addTo(this.map)
        else this.freqHeatmapLayerGroup.removeFrom(this.map)
    }

    clearSnailTrails(){
        this.snailTrailLG.clearLayers()
    }

    startSnailTrail(startPos:LatLng){
        this.snailTrailPoly = [startPos]
    }

    extendSnailTrail(pos: LatLng){
        this.snailTrailPoly.push(pos)
        if(this.snailTrailPoly.length == 2){
            this.snailTrailLayer = L.polyline(this.snailTrailPoly, {weight: 5, color: "#2FA4D7", opacity: 0.9}).addTo(this.map)
        }else{
            this.snailTrailLayer!.setLatLngs(this.snailTrailPoly)
        }
    }

    onToggleMinimize(){
        const container = document.getElementById("tracking-map")!
        if(container.classList.contains("minipreview")) {
            container.classList.remove("minipreview")
        }
        else {
            container.classList.add("minipreview")
        }
        this.map.invalidateSize()
    }
}