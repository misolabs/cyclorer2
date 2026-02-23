import type { GeoJsonAreaCollection, GeoJsonRouting, GeoJsonRoutingollection, GeoJsonArea, GeoJsonEntrypointCollection } from "../models/geo.ts"
import * as L from 'leaflet'
import type {AreaNode, LatLon} from "../models/models.ts";
import {LatLng} from "leaflet";

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
  </table>`
  layer.bindPopup(html)
}

export class TrackingMap{
    map: L.Map
    positionMarker: L.Marker|null = null
    neighbourMarker: L.CircleMarker[] = []
    snappedEdge: L.Polyline

    constructor(elName: string){
        this.map = L.map(elName)
        this.snappedEdge = L.polyline([], {color: "#ff7f00"}).addTo(this.map)
    }

    initBaseLayer(center: L.LatLng, zoomLevel: number){
        // Base map tiles from OSM
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map)
        this.map.setView(center, zoomLevel)
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
            
            L.rectangle(bounds,{weight:1, color: (features[i].properties.total_length > 200 ? "Purple": "Blue")})
            .bindPopup(`area: <b>${features[i].properties.area_id}</b>`)
            .addTo(this.map)
    //        .on("mouseover", (e:L.LeafletMouseEvent) => {e.target.setStyle({color: "white"})})
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

    addPositionMarker(startPos: L.LatLng, listener: (e: L.DragEndEvent)=>void){
        this.positionMarker = L.marker(startPos, {draggable: true}).addTo(this.map)
        this.positionMarker.addEventListener("dragend", listener)
    }

    setAreaMarker(areas: AreaNode[]): void{
        // If we need more markers, add them
        if(this.neighbourMarker.length < areas.length){
            for(let i = 0; i <= areas.length - this.neighbourMarker.length; i++){
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
        }else if(this.neighbourMarker.length > areas.length){
            const marker = this.neighbourMarker.pop()
            if(marker)
                this.map.removeLayer(marker)
        }
        // Update position
        for(let i=0; i < areas.length; i++){
            this.neighbourMarker[i].setLatLng(new LatLng(areas[i].position.lat, areas[i].position.lon))
        }
    }

    setSnappedEdge(poly: LatLon[]){
        const lfPoly = poly.map(e => new L.LatLng(e.lat, e.lon))
        this.snappedEdge.setLatLngs(lfPoly)
    }
}