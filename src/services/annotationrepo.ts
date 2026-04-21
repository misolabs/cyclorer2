
import type {
    EdgeAnnotation,
    EdgeAnnotationCreateEvent, EdgeAnnotationRequest,
    LocationAnnotation,
    LocationAnnotationJson
} from "../models/models.ts";

const API_BASE = "https://cyclotation.fly.dev";
const LOCATION_ENDPOINTS = "/annotations/locations"
const EDGE_ENDPOINTS = "/annotations/edges"

export class AnnotationRepo{
    repo: Map<number, LocationAnnotation>
    edgeRepo: Map<number, EdgeAnnotation>

    constructor() {
        this.repo = new Map()
        this.edgeRepo = new Map()
    }

    async add(la: LocationAnnotation): Promise<LocationAnnotation>{
        // Send to annotation server
        const response = await fetch(`${API_BASE}${LOCATION_ENDPOINTS}`, {
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
                const text= await response.text()
                const annotation = this.textToAnnotation(text)
                if(annotation.id)
                    this.repo.set(annotation.id, annotation)
                return annotation
            }catch(err){console.error(err); throw err}
        }else throw Error("POST request failed with status code " + response.status)
    }

    async addEdge(ea: EdgeAnnotationRequest): Promise<EdgeAnnotation>{
        // Send to annotation server
        const response = await fetch(`${API_BASE}${EDGE_ENDPOINTS}`, {
            headers: {"Content-Type": "application/json",},
            method: 'POST', body: JSON.stringify({
                category: ea.category,
                timestamp: ea.timestamp,
                comment: ea.comment,
                edge_id: ea.edge_id
            })})

        if(response.status == 200){
            try {
                const text= await response.text()
                const annotation: EdgeAnnotation = JSON.parse(text)
                if(annotation.id)
                    this.edgeRepo.set(annotation.id, annotation)
                return annotation
            }catch(err){console.error(err); throw err}
        }else throw Error("POST request failed with status code " + response.status)
    }

    async delete(id: number){
        if(this.repo.has(id)){
            const response = await fetch(`${API_BASE}${LOCATION_ENDPOINTS}/${id}`, {method: "DELETE"})
            if(response.status == 200){
                this.repo.delete(id)
            }
        }
    }

    async deleteEdge(id: number): Promise<boolean>{
        if(this.edgeRepo.has(id)){
            const response = await fetch(`${API_BASE}${EDGE_ENDPOINTS}/${id}`, {method: "DELETE"})
            if(response.status == 200){
                this.edgeRepo.delete(id)
                return true
            }
        }
        return false
    }

    findByEdgeId(edgeId: string): EdgeAnnotation | undefined {
        let result: EdgeAnnotation | undefined = undefined
        this.edgeRepo.forEach((edge, id) => {
            if(edge.edge_id == edgeId){
                console.log("found edge ID", edge.edge_id)
                result = edge
            }
        })

        return result
    }

    getAll(){
        return this.toArray()
    }

    getAllEdges(){
        return [...this.edgeRepo].map(([name, value]) => value)
    }

    get(id: number){
        return this.repo.get(id)
    }

    async update(annotation: LocationAnnotation):Promise<LocationAnnotation|undefined>{
        if(annotation.id && this.repo.has(annotation.id)){
            const response = await fetch(`${API_BASE}${LOCATION_ENDPOINTS}/${annotation.id}`, {
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
                const text= await response.text()
                const annotation = this.textToAnnotation(text)
                if(annotation.id)
                    this.repo.set(annotation.id, annotation)
                return annotation
            }else throw Error("PUT request failed with status code " + response.status)
        }
    }

    async fetchFromServer() {
        await Promise.all([
            this.fetchEdgeAnnotations(),
            this.fetchLocationAnnotations()
            ]
        )
    }

    async fetchLocationAnnotations(){
        // Send to annotation server
        const response = await fetch(`${API_BASE}${LOCATION_ENDPOINTS}`, {})

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

    async fetchEdgeAnnotations(){
        // Send to annotation server
        const response = await fetch(`${API_BASE}${EDGE_ENDPOINTS}`, {})

        if(response.status == 200){
            try {
                const json: EdgeAnnotation[] = JSON.parse(await response.text())
                for(const aJson of json){
                    try{
                        const annotation = {
                            category: aJson.category,
                            comment: aJson.comment,
                            id: aJson.id,
                            edge_id:aJson.edge_id,
                            timestamp: aJson.timestamp}

                        if(annotation.id)
                            this.edgeRepo.set(annotation.id, annotation)
                    }catch(err){console.error(err)}
                }
            }catch(err){console.error(err); throw err}
        }else throw Error("GET all edges request failed with status code " + response.status)
    }

    private textToAnnotation(text: string): LocationAnnotation {
        const json: LocationAnnotationJson = JSON.parse(text)
        const annotation = {
            category: json.category,
            location: {lat:json.lat, lon:json.lon},
            text: json.text,
            id: json.id,
            timestamp: json.timestamp}

        return annotation
    }

    private toArray(){
        return [...this.repo].map(([name, value]) => value)
    }
}