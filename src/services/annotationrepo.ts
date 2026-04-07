import type {LocationAnnotation, LocationAnnotationJson} from "../models/models.ts";
import {LatLng} from "leaflet";

const STORAGE_KEY = 'cyclorer2_annotations'

export class AnnotationRepo{
    repo: Map<number, LocationAnnotation>
    nextId = 0

    constructor() {
        this.repo = new Map()
        try {
            this.load()
        }catch(err){console.error(err)}
    }

    async add(la: LocationAnnotation): Promise<LocationAnnotation>{
        /*
        const record:LocationAnnotation = {id: this.nextId, ...la}
        this.repo.set(this.nextId, record)
        this.nextId++

        // Save on every addition
        this.save()
*/
        // Send to annotation server
        const response = await fetch("https://cyclotation.fly.dev/location", {
            headers: {"Content-Type": "application/json",},
            method: 'POST', body: JSON.stringify({
                category: la.category,
                lat: la.location.lat,
                lon: la.location.lon,
                timestamp: la.timestamp
            })})

        if(response.status == 200){
            try {
                const json: LocationAnnotationJson = JSON.parse(await response.text())
                return {
                    category: json.category,
                    location: {lat:json.lat, lon:json.lon},
    //                text: json.text,
                    id: json.id,
                    timestamp: json.timestamp}
            }catch(err){console.error(err); throw err}
        }else throw Error("POST request failed with status code " + response.status)
    }

    delete(id: number){
        if(this.repo.has(id)){
            this.repo.delete(id)
            this.save()
        }
    }

    getAll(){
        return this.toArray()
    }

    private save(){
        const arr = this.toArray();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
    }

    private load(){
        const storedData = localStorage.getItem(STORAGE_KEY)
        if(storedData){
            const list: LocationAnnotation[] = JSON.parse(storedData)
            // Calculate first unused id
            if(list && list.length > 0) {
                this.nextId = list
                    .map(a => a.id)
                    .filter(id => id != undefined)
                    .reduce((previousValue, currentValue): number => {
                        if (currentValue > previousValue) return currentValue
                        else return previousValue
                    }) + 1

                // Transform into map for fast access
                if (list) {
                    list.forEach((e: LocationAnnotation) => {
                        this.repo.set(e.id!, e)
                    })
                }
            }
        }
    }

    private toArray(){
        return [...this.repo].map(([name, value]) => value)
    }
}