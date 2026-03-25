import type {LocationAnnotation} from "../models/models.ts";

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

    add(la: LocationAnnotation){
        const record:LocationAnnotation = {id: this.nextId, ...la}
        this.repo.set(this.nextId, record)
        this.nextId++

        // Save on every addition
        this.save()

        return record
    }

    getAll(){
        return this.toArray()
    }

    save(){
        const arr = this.toArray();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
    }

    load(){
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

    toArray(){
        return [...this.repo].map(([name, value]) => value)
    }
}