import * as L from "leaflet";
import {LatLng, type PathOptions, type PolylineOptions} from "leaflet";

import type {EventBus} from "../eventbus.ts";
import {
    type AdjacencyInfo, type Edge, type EdgeAnnotation,
    EdgeAnnotationCategory,
    type JunctionInfo,
    type LatLon,
    type NodeId,
    NotificationType
} from "../models/models.ts";
import {haversineDistance} from "../crs/latlonmath.ts";
import {isOfHighwayType} from "../helpers.ts";

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
            rotate: true,
            rotateControl: false,
            dragging: true,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false
        })
    }

    styleRoutingEdge(edge: Edge, annotation?: EdgeAnnotation): PathOptions {
        if(edge.deadend)
            return edgeStyles.get("DEADEND")!
        else if(edge.access && (edge.access == "no" || edge.access == "private"))
            return edgeStyles.get("NOACCESS")!
        else if(edge.ride_count == 0 && isOfHighwayType(edge.highway, "path", "track"))
            return edgeStyles.get("UNVISITED")!
        else if(edge.ride_count == 0)
            return edgeStyles.get("URBAN_UNVISITED")!

        // default case
        return edgeStyles.get("DEFAULT")!
    }

    showJunctionExt(junction: JunctionInfo){
        const adj: AdjacencyInfo[] | undefined = this.bus.request("node:adjacency", junction.nodeId)

        if(adj) {
            for (const adjEdge of adj) {
                // Edge points in order starting from center node outward
                const edge = adjEdge.edge
                const points = edge.u == junction.nodeId ? edge.coordinates : edge.coordinates.toReversed()

                // Reduce to max length
                let cropped: LatLon[] = []
                let accLength = 0
                for(const p of points) {
                    if(accLength  < 100){
                        cropped.push(p)
                        if(cropped.length > 1){
                            accLength += haversineDistance(p, cropped[cropped.length - 2])
                        }
                    }
                }

                L.polyline(
                    cropped.map(p => new LatLng(p.lat, p.lon)),
                    this.styleRoutingEdge(edge)
                ).addTo(this.map)
            }
        }

        // Set view center and map rotation
        this.rotateMap(junction.orientation)
        this.map.setView(new L.LatLng(junction.pos.lat, junction.pos.lon), 17)
    }

    rotateMap(angle: number){
        this.map.setBearing(360 - angle)
    }
}