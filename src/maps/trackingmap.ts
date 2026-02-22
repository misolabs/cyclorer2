import type { GeoJsonAreaCollection, GeoJsonRouting, GeoJsonRoutingollection, GeoJsonArea, GeoJsonEntrypointCollection } from "../geo"
import * as L from 'leaflet'

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

// Draggable marker with coords popup
function moveListener(e: L.DragEndEvent){
    e.target.bindPopup(`Coordinates: <br/><b>${e.target.getLatLng().lat}<br/>${e.target.getLatLng().lng}</b>`)
}

export class TrackingMap{
    map: L.Map
    positionMarker: L.Marker|null = null

    constructor(elName: string){
        this.map = L.map(elName)
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
            .bindPopup(`${features[i].properties.total_length.toFixed(0)}`)
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
            return L.circleMarker(latlng, {color: "red", radius: 2, opacity:1})
            }
        }).addTo(this.map)        
    }

    addPositionMarker(startPos: L.LatLng){
        this.positionMarker = L.marker(startPos, {draggable: true}).addTo(this.map)
        this.positionMarker.addEventListener("dragend", moveListener)
    }
}