import * as L from "leaflet";
import {LatLng, type PathOptions, type PolylineOptions} from "leaflet";
import type {EventBus} from "../eventbus.ts";
import {EdgeAnnotationCategory, type LatLon, type NodeId, NotificationType} from "../models/models.ts";
import type {GeoJsonRoutingollection, RoutingEdgeProperties} from "../models/geo.ts";
import type {Feature, GeometryObject} from "geojson";

const edgeStyles: Map<string, PolylineOptions> = new Map([
    ["DEFAULT", {color: "white", weight: 9, opacity: 1}],
    ["DEADEND", {color: "grey", weight: 7}],
    ["NOACCESS", {color: "grey", weight: 7, dashArray:[10, 10]}],
    ["UNVISITED", {color: "red", weight: 11}],
    ["URBAN_UNVISITED", {color: "green", weight: 7}],
])

export class JunctionMap {
    bus: EventBus
    map: L.Map

    constructor(elName: string, bus: EventBus) {
        this.bus = bus

        this.map = L.map(elName, {
            zoomControl: false,
            attributionControl: false,
            rotateControl: false,
            dragging: true,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false
        })
        //this.map.setView(new L.LatLng(49.477015, 5.980889), 12)

        this.bus.onEvent("rds:routing:loaded", this.addRoutingLayer.bind(this))
    }

    addRoutingLayer(routingGeoData: GeoJsonRoutingollection){
        L.geoJSON(routingGeoData.features, {
            //onEachFeature: this.routingEdgePostprocess.bind(this),
            style: this.styleRoutingEdge.bind(this)
        }).addTo(this.map)
    }

    styleRoutingEdge(feature?: Feature<GeometryObject, RoutingEdgeProperties>): PathOptions {
        if(feature && feature.properties.deadend)
            return edgeStyles.get("DEADEND")!
        else if(feature && feature.properties.access && (feature.properties.access == "no" || feature.properties.access == "private"))
            return edgeStyles.get("NOACCESS")!
        else if(feature && feature.properties.ride_count == 0 && this.isOfType(feature.properties.highway, "path", "track"))
            return edgeStyles.get("UNVISITED")!
        else if(feature && feature.properties.ride_count == 0)
            return edgeStyles.get("URBAN_UNVISITED")!

        // default case
        return edgeStyles.get("DEFAULT")!
    }

    showJunctionMap(pos: LatLon){
        // Get node neighbours from routing engine
        this.map.setView(new L.LatLng(pos.lat, pos.lon), 19)
    }

    // TODO Duplicated code
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
}