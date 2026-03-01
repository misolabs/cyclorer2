import L from 'leaflet'
import type { GeoJsonAreaCollection, GeoJsonRouting, GeoJsonRoutingollection, GeoJsonArea, GeoJsonEntrypointCollection } from "../models/geo.ts"

import type {AreaNode, LatLon, Route} from "../models/models.ts";
import {LatLng} from "leaflet";

import 'leaflet/dist/leaflet.css'

// Marker cluster plugin
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"

// Import marker images so Vite bundles them
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

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

export class TrackingMap{
    map: L.Map
    positionMarker: L.Marker|null = null
    headingMarker: L.Marker|null = null
    neighbourMarker: L.CircleMarker[] = []
    snappedEdge: L.Polyline
    routeLayer: L.Polyline
    headingIcon: L.Icon
    positionIcon: L.Icon

    constructor(elName: string){
        this.map = L.map(elName, { rotate: true })

        L.control.scale({metric: true, imperial: false}).addTo(this.map)

        this.snappedEdge = L.polyline([], {color: "#ff7f00", weight: 9}).addTo(this.map)
        this.routeLayer = L.polyline([], {color: "#ff7f00", weight: 9}).addTo(this.map)
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
    }

    initBaseLayer(center: L.LatLng, zoomLevel: number){
        // Base map tiles from OSM
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map)
        this.map.setView(center, zoomLevel)
    }

    addDeadendsLayer(routingGeoData: GeoJsonRoutingollection){
        // Mark deadends with broad black lines
        L.geoJSON(routingGeoData.features, {
            filter: (feature) => {return feature.properties.deadend},
            style: {color: "black", weight: 7}
        }).addTo(this.map)
    }

    addRoutingLayer(routingGeoData: GeoJsonRoutingollection){
        // Simply draw entrypoints as markers
        L.geoJSON(routingGeoData.features, {
            onEachFeature: popupRoutingEdge,
            style: {color: "grey", weight: 2}
        }).addTo(this.map)        
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
            .bindPopup(`area: <b>${features[i].properties.area_id}</b>`)
            .addTo(this.map)
        }
    
        // Draw edge network
        L.geoJSON(areaData.features,
            {
            style: {
            color: "red",
            weight: 2,
            opacity: 0.7
            }
        }).addTo(this.map) 
        
        // Draw entrypoints
        L.geoJSON(entrypointsData.features,{
            pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {color: "red", radius: 2, opacity:1}).bindPopup(`nodeid: <b>${feature.properties.osmid}</b>`)
            }
        }).addTo(this.map)        
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

    setPosition(pos: LatLon){
        const leafPos = new LatLng(pos.lat, pos.lon)
        this.map.setView(leafPos)
        this.positionMarker?.setLatLng(leafPos)
    }
}