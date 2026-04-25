
import type {
    EdgeAnnotation,
    EdgeAnnotationCreateEvent, EdgeAnnotationRequest,
    LocationAnnotation,
    LocationAnnotationJson, LocationAnnotationRequest
} from "../models/models.ts";
import type {EventBus} from "../eventbus.ts";

const API_BASE = "https://cyclotation.fly.dev";
const LOCATION_ENDPOINTS = "/annotations/locations"
const EDGE_ENDPOINTS = "/annotations/edges"

interface RequestQueueEntry{
    url: string,
    headers?: HeadersInit,
    method: string,
    body?: string,
    retryCount: number,
}

export class AnnotationRepo{
    bus: EventBus
    repo: Map<string, LocationAnnotation>
    edgeRepo: Map<number, EdgeAnnotation>

    constructor(bus: EventBus) {
        this.bus = bus
        this.repo = new Map()
        this.edgeRepo = new Map()
    }

    getQueue(): RequestQueueEntry[] {
        return JSON.parse(localStorage.getItem('annotationsRequestQueue') || '[]')
    }

    setQueue(queue: RequestQueueEntry[]) {
        localStorage.setItem('annotationsRequestQueue', JSON.stringify(queue))
    }

    addToQueue(request: RequestQueueEntry){
        const queue = this.getQueue()
        queue.push(request)
        this.setQueue(queue)
        this.processQueue()
    }

    async processQueue() {
        const queue = this.getQueue()
        const remaining = []

        for (const item of queue) {
            try {
                const res = await fetch(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                })

                if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
                console.log("Successfully sent request", item)
                this.bus.emit("notification:show", {
                    type: "DEBUG",
                    caption: "Annotation synced",
                    description: `${item.method} ${item.url} was sent successfully.`,
                    autocloseDelay: 1500,
                })
            } catch {
                item.retryCount++
                if(item.retryCount < 5) {
                    remaining.push(item)
                    this.bus.emit("notification:show", {
                        type: "WARNING",
                        caption: "Annotation sync retry",
                        description: `${item.method} ${item.url} failed. Retrying (${item.retryCount}/5).`,
                        autocloseDelay: 3500,
                    })
                } else {
                    console.error("Failed to send request 5 times, abandoning task", item)
                    this.bus.emit("notification:show", {
                        type: "ERROR",
                        caption: "Annotation sync failed",
                        description: `${item.method} ${item.url} failed after 5 attempts and was abandoned.`,
                        autocloseDelay: 5000,
                    })
                }
            }
        }

        this.setQueue(remaining)
    }

    add(la: LocationAnnotationRequest): void {
        const request: RequestQueueEntry = {
            url: `${API_BASE}${LOCATION_ENDPOINTS}`,
            method: "POST",
            headers: {"Content-Type": "application/json",},
            body: JSON.stringify(la),
            retryCount: 0
        }

        // Add annotation to local repo
        this.repo.set(la.id, la)

        // Add to request queue for sending to server
        this.addToQueue(request)
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

    async delete(id: string){
        if(this.repo.has(id)){
            // Create (possibly offline) request
            const request: RequestQueueEntry = {
                url: `${API_BASE}${LOCATION_ENDPOINTS}/${id}`,
                method: "DELETE",
                headers: undefined,
                body: undefined,
                retryCount: 0
            }
            this.addToQueue(request)

            // In the meantime we already remove it from the UI
            this.repo.delete(id)
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

    get(id: string){
        return this.repo.get(id)
    }

    update(annotation: LocationAnnotation): LocationAnnotation{
        if(annotation.id && this.repo.has(annotation.id)){
            // Add to request queue
            const request: RequestQueueEntry = {
                url: `${API_BASE}${LOCATION_ENDPOINTS}/${annotation.id}`,
                method: "PUT",
                headers: {"Content-Type": "application/json",},
                body: JSON.stringify(annotation),
                retryCount: 0
            }
            this.addToQueue(request)

            // Store the new value in our local repo
            this.repo.set(annotation.id, annotation)
        }
        return annotation
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
                const json: LocationAnnotation[] = JSON.parse(await response.text())
                for(const annotation of json){
                    try{
                        if(annotation.id)
                            this.repo.set(annotation.id, annotation)
                    }catch(err){console.error(err)}
                }
            }catch(err){console.error(err); throw err}
            console.log("Loaded location annotations", this.repo.size)
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
