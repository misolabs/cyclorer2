import type {LocationAnnotation, LocationAnnotationJson} from "../models/models.ts";
import {LatLng} from "leaflet";

const STORAGE_KEY = 'cyclorer2_annotations'

export class AnnotationRepo{
    repo: Map<number, LocationAnnotation>
    nextId = 0

    constructor() {
        this.repo = new Map()
    }

    async add(la: LocationAnnotation): Promise<LocationAnnotation>{
        // Send to annotation server
        const response = await fetch("https://cyclotation.fly.dev/location", {
            headers: {"Content-Type": "application/json",},
            method: 'POST', body: JSON.stringify({
                category: la.category,
                lat: la.location.lat,
                lon: la.location.lon,
                timestamp: la.timestamp,
                text: la.text,
            })})

        if(response.status == 200){
            try {
                const json: LocationAnnotationJson = JSON.parse(await response.text())
                const annotation = {
                    category: json.category,
                    location: {lat:json.lat, lon:json.lon},
                    text: json.text,
                    id: json.id,
                    timestamp: json.timestamp}
                if(annotation.id)
                    this.repo.set(annotation.id, annotation)
                return annotation
            }catch(err){console.error(err); throw err}
        }else throw Error("POST request failed with status code " + response.status)
    }

    async delete(id: number){
        if(this.repo.has(id)){
            const response = await fetch("https://cyclotation.fly.dev/location/" + id, {method: "DELETE"})
            if(response.status == 200){
                this.repo.delete(id)
            }
        }
    }

    getAll(){
        return this.toArray()
    }

    get(id: number){
        return this.repo.get(id)
    }

    async update(annotation: LocationAnnotation):Promise<LocationAnnotation|undefined>{
        if(annotation.id && this.repo.has(annotation.id)){
            const response = await fetch("https://cyclotation.fly.dev/location/" + annotation.id, {
                headers: {"Content-Type": "application/json",},
                method: 'PUT', body: JSON.stringify({
                    id: annotation.id,
                    category: annotation.category,
                    lat: annotation.location.lat,
                    lon: annotation.location.lon,
                    timestamp: annotation.timestamp,
                    text: annotation.text,
                })})

            if(response.status == 200){
                const json: LocationAnnotationJson = JSON.parse(await response.text())
                const annotation = {
                    category: json.category,
                    location: {lat:json.lat, lon:json.lon},
                    text: json.text,
                    id: json.id,
                    timestamp: json.timestamp}
                if(annotation.id)
                    this.repo.set(annotation.id, annotation)
                return annotation
            }
        }
    }

    async fetchFromServer(){
        // Send to annotation server
        const response = await fetch("https://cyclotation.fly.dev/location",)

        if(response.status == 200){
            try {
                const json: LocationAnnotationJson[] = JSON.parse(await response.text())
                for(const aJson of json){
                    try{
                        const annotation = {
                            category: aJson.category,
                            location: {lat:aJson.lat, lon:aJson.lon},
                            text: aJson.text,
                            id: aJson.id,
                            timestamp: aJson.timestamp}

                        if(annotation.id)
                            this.repo.set(annotation.id, annotation)
                    }catch(err){console.error(err)}
                }
            }catch(err){console.error(err); throw err}
        }else throw Error("POST request failed with status code " + response.status)
    }

    private toArray(){
        return [...this.repo].map(([name, value]) => value)
    }
}