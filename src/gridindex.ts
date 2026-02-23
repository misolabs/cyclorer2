import type {BoundingBox, CellIndex, LatLon, Edge, AreaNode, Node} from "./models";

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

    abstract addFeature(feature: T): boolean

    findNeighbours(pos: LatLon, depth:number=1): T[]{
        const {x, y} = this.latlonToCell(pos)
        const result: T[] = [];

        for (let dx = -depth; dx <= depth; dx++) {
            for (let dy = -depth; dy <= depth; dy++) {
                const key = this.cellToIndex({x:x+dx, y:y+dy});
                if (this.grid[key] != undefined) {
                    result.push(...this.grid[key]);
                }
            }
        }
        return result;

    }
}

export class EdgeGrid extends GridIndex<Edge>{
    addFeature(feature: Edge): boolean{
        // Get the corner grid cells indices from bbox
        const minC = this.latlonToCell(feature.bbox.min)
        const maxC = this.latlonToCell(feature.bbox.max)

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

export class NodeGrid extends GridIndex<Node>{
    addFeature(feature: Node): boolean{
        // Get the corner grid cells indices from bbox
        const c = this.latlonToCell(feature.position)
        const i = this.cellToIndex(c);

        if (!this.grid[i])
            this.grid[i] = [];
        this.grid[i].push(feature);

        return true
    }
}
