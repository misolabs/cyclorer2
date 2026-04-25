import L, {LatLngBounds, type LeafletEvent, Marker, type PathOptions, type PolylineOptions} from 'leaflet'
import {
    Icon as ExtraMarkersIcon,
    PinCircleBorder,
    PinCirclePanel,
    PointCircle,
    PointCircleBorder
} from 'leaflet-extra-markers'
import type {
    GeoJsonAreaCollection, GeoJsonRouting, GeoJsonRoutingollection, GeoJsonArea, GeoJsonEntrypointCollection,
    RoutingEdgeProperties
} from "../models/geo.ts"

import {
    type Area, type AreaNode, type EdgeAnnotation,
    EdgeAnnotationCategory, type LatLon, type LocationAnnotation, type Route
} from "../models/models.ts";
import {LatLng} from "leaflet";

import 'leaflet/dist/leaflet.css'
import '../css/leaflet-custom.css'

// Marker cluster plugin
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"

// Import marker images so Vite bundles them
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type {EventBus} from "../eventbus.ts";
import type {Feature, GeometryObject} from "geojson";

// Fix default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
})

function navigateTo(areaId: number){
    window.dispatchEvent(new CustomEvent('cycSelectArea', {detail: { areaId }}))
}

interface TileService{
    attribution: string
    url: string
}

const edgeStyles: Map<string, PolylineOptions> = new Map([
    ["DEFAULT", {color: "rgb(39, 105, 163)", weight: 3, opacity: 1}],
    ["DEADEND", {color: "black", weight: 5}],
    ["UNVISITED", {color: "red", weight: 3}],
    ["URBAN_UNVISITED", {color: "green", weight: 3}],

    [EdgeAnnotationCategory.EA_FAVORITE, {color: "yellow", weight: 5}],
    [EdgeAnnotationCategory.EA_KEEPOUT, {color: "black", weight: 5, dashArray:[10, 10]}],
    [EdgeAnnotationCategory.EA_EXPLORE, {color: "blue", weight: 5}],
    [EdgeAnnotationCategory.EA_STEEP, {color: "purple", weight: 5}],
])

const osmTileService: TileService = {url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "OpenStreetMap"}
const cyclosmTileService: TileService = {url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", attribution: "CyclOSM"}
const openTopoTileService: TileService = {url: "https://c.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "OpenTopoMap"}

const tileServices:Map<string, TileService> = new Map([
    ["osm", osmTileService],
    ["cyclosm", cyclosmTileService],
    ["opentopo", openTopoTileService],
])

let currentTileService: TileService | null = null

type AnnotationMarkerOptions = NonNullable<ConstructorParameters<typeof ExtraMarkersIcon>[0]>

const annotationMarkerBaseOptions = {
    svg: PinCircleBorder,
    scale: 1.2,
    shadow: "cast",
    accentColor: "white",
    contentColor: "white",
    rootClass: "annotation-marker",
    contentWrapperClass: "annotation-marker__content",
    contentWrapperStyle: {
        fontFamily: '"Material Symbols Rounded"',
        fontSize: "24px",
        lineHeight: "1",
        fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        fontFeatureSettings: "'liga'",
    },
    svgStyle: {
        overflow: "visible",
    },
} satisfies AnnotationMarkerOptions

const positionMarkerBaseOptions = {
    svg: PointCircleBorder,
    scale: 1.5,
    shadow: "none",
    color: "orange",
    accentColor: "white",
    contentColor: "white",
    rootClass: "annotation-marker",
    contentWrapperClass: "annotation-marker__content",
    contentWrapperStyle: {
        fontFamily: '"Material Symbols Rounded"',
        fontSize: "24px",
        lineHeight: "1",
        fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        fontFeatureSettings: "'liga'",
    },
    svgStyle: {
        overflow: "visible",
    },
} satisfies AnnotationMarkerOptions

const annotationMarkerPalette = {
    EXPLORE: {glyph: "question_mark", color: "blue"},
    DANGER: {glyph: "skull", color: "red"},
    FAVORITE: {glyph: "favorite", color: "green"},
    CLIMB: {glyph: "elevation", color: "purple"},
    QUICKDROP: {glyph: "tour", color: "orange"},
} as const

function createAnnotationMarkerIcon(glyph: string, color: string): ExtraMarkersIcon {
    return new ExtraMarkersIcon({
        ...annotationMarkerBaseOptions,
        color,
        content: () => {
            const content = document.createElement("span")
            content.className = "material-symbols-rounded annotation-marker__glyph"
            content.textContent = glyph
            return content
        },
    })
}

export class TrackingMap{
    bus: EventBus
    mobileMode: boolean

    map: L.Map
    positionMarker: L.Marker|null = null
    neighbourMarker: L.CircleMarker[] = []
    snappedEdge: L.Polyline
    routeLayer: L.Polyline
    positionIcon: ExtraMarkersIcon

    annotationIcons: Map<string, ExtraMarkersIcon> = new Map()
    baseLayer: L.TileLayer | null = null
    areasLayerGroup: L.LayerGroup = L.layerGroup()
    areaBBoxLayerGroup: L.LayerGroup = L.layerGroup()
    deadendsLayerGroup: L.LayerGroup = L.layerGroup()
    freqHeatmapLayerGroup: L.LayerGroup = L.layerGroup()
    areaHighlightLG: L.LayerGroup = L.layerGroup()
    snailTrailLG: L.LayerGroup = L.layerGroup()
    annotationsLG: L.LayerGroup = L.layerGroup()

    edgeNetworkLayers: Map<string, L.Polyline> = new Map([])

    snailTrailLayer!: L.Polyline
    snailTrailPoly: LatLng[] = []

    riderViewCenter: LatLng = new LatLng(0,0)
    riderViewZoom = 17
    globalViewZoom: number = 15

    heading: number = 0
    resetHeading = true

    constructor(elName: string, mobileMode: boolean, bus:EventBus){
        this.bus = bus
        this.mobileMode = mobileMode
        this.map = L.map(elName, {
            zoomControl: false,
            rotate: true,
            rotateControl: false,
            attributionControl: false,
            zoom: this.riderViewZoom,
            doubleClickZoom: false,
        })
        L.control.scale({metric: true, imperial: false, position: "bottomright"}).addTo(this.map)

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
        this.positionIcon = new ExtraMarkersIcon({
            ...positionMarkerBaseOptions,
            contentHtml: '<span class="material-symbols-rounded" style="font-size: 32px;">navigation</span>',
        })

        // Annotation icons use the same extra-markers base style and only vary by glyph/color.
        for (const [category, marker] of Object.entries(annotationMarkerPalette)) {
            this.annotationIcons.set(category, createAnnotationMarkerIcon(marker.glyph, marker.color))
        }

        // Always visible
        this.areasLayerGroup.addTo(this.map)
        this.areaHighlightLG.addTo(this.map)
        this.snailTrailLG.addTo(this.map)
        this.annotationsLG.addTo(this.map)

        // Connect to event bus
        this.bus.onEvent("preview:minimize", this.onToggleMinimize.bind(this))

        // TODO: Move to right location
        this.bus.onEvent("annotation:edge:modified", (a: EdgeAnnotation) => {
            const glyphs:Map<string, string> = new Map([
                ["FAVORITE", "favorite"],
                ["EXPLORE", "question_mark"],
                ["KEEPOUT", "skull"],
                ["STEEPCLIMB", "elevation"],
            ])

            const layer = this.edgeNetworkLayers.get(a.edge_id)
            if(layer){
                // Update context menu
                this.routingEdgePostprocess(layer.feature as GeoJsonRouting, layer, a)

                // Update drawing style
                const style = edgeStyles.get(a.category)
                if(style) layer.setStyle(style)
                else console.error("Edge category not found", a.category)

                // Update edge tooltip
                if(a.comment) layer.bindTooltip(a.comment, {permanent: true})
                else layer.bindTooltip(`<span class='material-symbols-rounded' style='font-size: 14px'>${glyphs.get(a.category)}</span> ${a.category}`, {permanent: true})
            }
        })

        // When a style override (=custom annotation) is deleted we revert to the standard rendering style for that edge
        this.bus.onEvent("annotation:edge:deleted", (a: EdgeAnnotation) => {
            const layer = this.edgeNetworkLayers.get(a.edge_id)
            if(layer){
                layer.setStyle(this.styleRoutingEdge(layer.feature))
                layer.getTooltip()?.removeFrom(this.map)
            }
        })

        // After we come back from powersave mode we just set the heading without history
        this.bus.onEvent("powersave:disable", () => {this.resetHeading = true})

        // If we are riding we disbale all map intercation to make hitting buttons easier
        this.bus.onEvent("geolocation:riding", (riding: boolean) =>{this.disableMapInteraction(riding)})
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
            onEachFeature: this.routingEdgePostprocess.bind(this),
            style: this.styleRoutingEdge.bind(this)
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
        /*
        L.geoJSON(areaData.features,
            {
                style: {
                color: "red",
                weight: 3,
                opacity: 1,
            },
        }).addTo(this.areasLayerGroup)
*/
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

    highlightArea(area: Area | null){
        this.areaHighlightLG.clearLayers()
        if(area){
            const areaLayer = L.geoJSON(area.geoData, {
                //filter: (feature) => {return feature.properties.area_id == area.area_id},
                style: {color: "yellow", weight: 7}
            }).addTo(this.areaHighlightLG)

            //this.zoomFrameArea(areaLayer.getBounds())
            //this.bus.eventEmit("zoom:framed:area", area)
        }
        else{
            //this.zoomFrameRider()
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
        // Sometimes we need a clean break
        if(this.resetHeading){
            this.heading = angle
            this.resetHeading = false
        }else {
            const alpha = 0.8

            let delta = ((angle - this.heading + 540) % 360) - 180;

            // move a fraction toward target
            this.heading = this.heading + (1 - alpha) * delta;

            // normalize back to [0, 360)
            this.heading = (this.heading + 360) % 360;
        }
        // Set a lightly quantized angle in 5° steps to avoid too much jitter
        const quantized = Math.round(this.heading / 5) * 5
        this.map.setBearing(quantized)
    }

    addAnnotation(annotation: LocationAnnotation) {
        const id = annotation.id
        if(id == undefined) return

        let marker: L.Marker
        if(annotation.category === "TEXT" && annotation.text){
            marker = L.marker(new LatLng(annotation.location.lat, annotation.location.lon),
                {
                    icon: L.divIcon({
                        className: '',
                        html: `<div class="roboto-font map-label">${annotation.text}</div>`,
                    }), draggable: true,
                }).addTo(this.map)

        }else {
            marker = L.marker(new LatLng(annotation.location.lat, annotation.location.lon),
                {icon: this.annotationIcons.get(annotation.category), draggable: true})
                .addTo(this.annotationsLG)
        }
        // Attach handler
        this.addAnnotationPopup(annotation, marker)
        // Handler for modifying position
        marker.on("dragend", (e ) => {
            this.bus.emitEvent("annotation:location:modify:pos", {id: id, pos:{lat: e.target.getLatLng().lat, lon: e.target.getLatLng().lng }})
        })
    }

    addAnnotationPopup(annotation: LocationAnnotation, marker: Marker){
        const tsLabel = new Date(annotation.timestamp).toDateString()
        const popupContent = document.createElement("div");

        // Popup content definition
        popupContent.innerHTML = `
        <span class="roboto-font mb-3" style="font-weight: bold">
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
            // Remove marker from map
            this.map.removeLayer(marker)
            // And ask to remove permanently from backend
            this.bus.emitEvent("annotation:location:delete", annotation.id!);
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

    zoomFrameArea(bounds: LatLngBounds){
        // Calculate bounds of area with current position
        this.riderViewCenter = this.map.getCenter()
        this.riderViewZoom = this.map.getZoom()

        // Show preview of the full route
        const extBounds = bounds.extend(this.positionMarker!.getLatLng())
        this.map.fitBounds(extBounds, {padding: [50, 50]})
    }

    zoomFrameRider(){
        this.map.setView(this.riderViewCenter, this.riderViewZoom)
    }

    routingEdgePostprocess(feature: GeoJsonRouting, layer: L.Polyline, annotation: EdgeAnnotation|undefined = undefined){
        // When riding popups only get in the way
        if(!this.mobileMode) {
            const popupContainer = document.createElement("div");

            popupContainer.innerHTML = `<table>
          <tr>
          <td>Id</td>
          <td><b>${feature.properties.edge_id}</b></td>
          </tr>
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
          <tr>
          <td>Ride count</td>
          <td><b>${feature.properties.ride_count}</b></td>
          </tr>
          </table>
          <textarea rows="3" placeholder="Comment" class="cyc-edge-annotation-comment-input" style="width: 100%;"></textarea>
          <div class="mt-3 d-flex flex-column gap-2">
            <div class="btn-group flex-wrap" role="radiogroup" aria-label="Edge annotation category" style="width: 100%;">
              <input type="radio" class="btn-check cyc-menu-button cyc-only-desktop cyc-edge-annotation-favorite-btn" name="cyc-edge-annotation-${feature.properties.edge_id}" id="cyc-edge-annotation-${feature.properties.edge_id}-favorite" autocomplete="off" ${annotation?.category === EdgeAnnotationCategory.EA_FAVORITE ? "checked" : ""}>
              <label class="btn btn-outline-secondary cyc-edge-annotation-radio-label cyc-edge-annotation-radio-label--favorite cyc-menu-button cyc-only-desktop" for="cyc-edge-annotation-${feature.properties.edge_id}-favorite" style="position: relative;">
                  <span class="material-symbols-rounded">favorite</span>
              </label>
              <input type="radio" class="btn-check cyc-menu-button cyc-only-desktop cyc-edge-annotation-keepout-btn" name="cyc-edge-annotation-${feature.properties.edge_id}" id="cyc-edge-annotation-${feature.properties.edge_id}-keepout" autocomplete="off" ${annotation?.category === EdgeAnnotationCategory.EA_KEEPOUT ? "checked" : ""}>
              <label class="btn btn-outline-secondary cyc-edge-annotation-radio-label cyc-edge-annotation-radio-label--keepout cyc-menu-button cyc-only-desktop" for="cyc-edge-annotation-${feature.properties.edge_id}-keepout" style="position: relative;">
                  <span class="material-symbols-rounded">back_hand</span>
              </label>
              <input type="radio" class="btn-check cyc-menu-button cyc-only-desktop cyc-edge-annotation-explore-btn" name="cyc-edge-annotation-${feature.properties.edge_id}" id="cyc-edge-annotation-${feature.properties.edge_id}-explore" autocomplete="off" ${annotation?.category === EdgeAnnotationCategory.EA_EXPLORE ? "checked" : ""}>
              <label class="btn btn-outline-secondary cyc-edge-annotation-radio-label cyc-edge-annotation-radio-label--explore cyc-menu-button cyc-only-desktop" for="cyc-edge-annotation-${feature.properties.edge_id}-explore" style="position: relative;">
                  <span class="material-symbols-rounded">not_listed_location</span>
              </label>
              <input type="radio" class="btn-check cyc-menu-button cyc-only-desktop cyc-edge-annotation-steep-btn" name="cyc-edge-annotation-${feature.properties.edge_id}" id="cyc-edge-annotation-${feature.properties.edge_id}-steep" autocomplete="off" ${annotation?.category === EdgeAnnotationCategory.EA_STEEP ? "checked" : ""}>
              <label class="btn btn-outline-secondary cyc-edge-annotation-radio-label cyc-edge-annotation-radio-label--steep cyc-menu-button cyc-only-desktop" for="cyc-edge-annotation-${feature.properties.edge_id}-steep" style="position: relative;">
                  <span class="material-symbols-rounded">elevation</span>
              </label>
            </div>
            <button class="btn btn-danger cyc-menu-button cyc-only-desktop cyc-edge-annotation-delete-btn" style="position: relative;">
                <span class="material-symbols-rounded">ink_eraser</span>
            </button>
          </div>`

            const commentArea = popupContainer.querySelector(".cyc-edge-annotation-comment-input")! as HTMLTextAreaElement
            if(commentArea && annotation && annotation.comment){
                commentArea.value = annotation.comment
            }

            // Wire up the radio buttons for now. The actual action handlers can
            // be swapped out later without changing the popup markup.
            const favButton = popupContainer.querySelector(".cyc-edge-annotation-favorite-btn");
            favButton!.addEventListener("click", () => {
                this.bus.emitEvent("annotation:edge:create", {
                    edge_id: feature.properties.edge_id,
                    category: EdgeAnnotationCategory.EA_FAVORITE,
                    comment: commentArea.value
                })
            });

            const avoidButton = popupContainer.querySelector(".cyc-edge-annotation-keepout-btn");
            avoidButton!.addEventListener("click", () => {
                this.bus.emitEvent("annotation:edge:create", {
                    edge_id: feature.properties.edge_id,
                    category: EdgeAnnotationCategory.EA_KEEPOUT,
                    comment: commentArea.value
                })
            })

            const exploreButton = popupContainer.querySelector(".cyc-edge-annotation-explore-btn");
            exploreButton!.addEventListener("click", () => {
                this.bus.emitEvent("annotation:edge:create", {
                    edge_id: feature.properties.edge_id,
                    category: EdgeAnnotationCategory.EA_EXPLORE,
                    comment: commentArea.value
                })
            })

            const steepButton = popupContainer.querySelector(".cyc-edge-annotation-steep-btn");
            steepButton!.addEventListener("click", () => {
                this.bus.emitEvent("annotation:edge:create", {
                    edge_id: feature.properties.edge_id,
                    category: EdgeAnnotationCategory.EA_STEEP,
                    comment: commentArea.value
                })
            })

            // TODO - Handle event in AnnotationRepo
            const deleteButton = popupContainer.querySelector(".cyc-edge-annotation-delete-btn");
            deleteButton!.addEventListener("click", () => {
                this.bus.emitEvent("annotation:edge:delete", feature.properties.edge_id)
            })

            layer.bindPopup(popupContainer)
        }
        // Add to layers map
        this.edgeNetworkLayers.set(feature.properties.edge_id, layer)
    }

    isOfType(
        highway: string | string[] | undefined,
        ...types: string[]
    ): boolean {
        if (!highway) return false;

        if (Array.isArray(highway)) {
            return highway.some(h => types.includes(h));
        }

        return types.includes(highway);
    }

    styleRoutingEdge(feature?: Feature<GeometryObject, RoutingEdgeProperties>): PathOptions {
        if(feature && feature.properties.deadend)
            return edgeStyles.get("DEADEND")!
        else if(feature && feature.properties.ride_count == 0 && this.isOfType(feature.properties.highway, "path", "track"))
            return edgeStyles.get("UNVISITED")!
        else if(feature && feature.properties.ride_count == 0)
            return edgeStyles.get("URBAN_UNVISITED")!

        // default case
        return edgeStyles.get("DEFAULT")!
    }

    disableMapInteraction(disable: boolean) {
        if (disable) {
            this.map.dragging.disable();
            this.map.touchZoom.disable();
            //this.map.doubleClickZoom.disable();
            //this.map.scrollWheelZoom.disable();
        } else {
            this.map.dragging.enable();
            this.map.touchZoom.enable();
            //this.map.doubleClickZoom.enable();
            //this.map.scrollWheelZoom.enable();
        }
    }
}
