import type { BoundingBox, CellIndex, LatLon, Edge } from "./models";

export abstract class GridIndex<T>{
    resolution: number

    gridMinLon: number
    gridMinLat: number
    gridW: number
    gridH: number

    projCenterLon: number
    projCenterLat: number

    grid:T[][];

    constructor(bbox: BoundingBox, resolution: number = 0.0005){
        this.resolution = resolution

        this.gridMinLon = bbox.min.lon
        this.gridMinLat = bbox.min.lat

        this.gridW = Math.ceil((bbox.max.lon - bbox.min.lon) / resolution); // LON
        this.gridH = Math.ceil((bbox.max.lat - bbox.min.lat) / resolution); // LAT

        this.projCenterLon = (bbox.min.lon + bbox.max.lon) / 2
        this.projCenterLat = (bbox.min.lon + bbox.max.lat) / 2

        this.grid = new Array<Array<T>>(this.gridW * this.gridH)
    }

    cellToIndex(cell: CellIndex): number{
        return cell.y * this.gridW + cell.x
    }

    latlonToCell(c: LatLon):CellIndex{
        const x = Math.floor((c.lon - this.gridMinLon) / this.resolution);
        const y = Math.floor((c.lat - this.gridMinLat) / this.resolution);
    return { x, y };
    }

    abstract addFeature(feature: T, bbox: BoundingBox): boolean
}

export class EdgeGrid extends GridIndex<Edge>{
    addFeature(feature: Edge, bbox: BoundingBox): boolean{
        // Get the corner grid cells indices from bbox
        const minC = this.latlonToCell(bbox.min)
        const maxC = this.latlonToCell(bbox.max)

        // Register edge in every bbox cell that may be touched
        for (let x = minC.x; x <= maxC.x; x++) {
            for (let y = minC.y; y <= maxC.y; y++) {
                const i = this.cellToIndex({x, y});
                if (!this.grid[i]) 
                    this.grid[i] = [];
                this.grid[i].push(feature);
            }
        }
        return true
    }
}
