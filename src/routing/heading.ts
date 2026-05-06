// For heading direction
import type {Cartesian, LatLon} from "../models/models.ts";

const MIN_SPEED = 1.0
const MAX_HISTORY = 5;

export function computeHeading(startPos: LatLon, endPos: LatLon): number {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;

    const φ1 = toRad(startPos.lat);
    const φ2 = toRad(endPos.lat);
    const Δλ = toRad(endPos.lon - startPos.lon);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const deg = (toDeg(Math.atan2(y, x)) + 360) % 360;

    // Quantise to 6 opr 12 main directions for more stability
    //const quantised = Math.floor(deg / 60) * 60 + 30

    return deg
}

function modeFilter(headings: number[]) {
    const buckets = new Map()

    // Fill buckets
    for (const h of headings) {
        if (buckets.has(h))
            buckets.set(h, buckets.get(h) + 1)
        else buckets.set(h, 1)
    }

    // Find bucket with most entries
    let maxCount = 0
    let heading = 0
    for (const [k, v] of buckets) {
        if (v > maxCount) {
            maxCount = v
            heading = k
        }
    }
    return heading
}

function smoothAngle(prev: number, current: number, alpha: number) {
    const delta = ((((current - prev) % 360) + 540) % 360) - 180;
    return (prev + alpha * delta + 360) % 360;
}

function smoothVector(
    prev: { x: number; y: number },
    current: { x: number; y: number },
    alpha: number
) {
    const x = prev.x + alpha * (current.x - prev.x);
    const y = prev.y + alpha * (current.y - prev.y);

    const length = Math.hypot(x, y);

    return {
        x: x / length,
        y: y / length
    };
}

function vectorToBearing(v: Cartesian) {
    const radians = Math.atan2(v.x, v.y);
    return 360 - (radians * 180 / Math.PI + 360) % 360;
}

export class Heading {
    headingHistory: number[] = [];
    lastPos: LatLon | null = null
    stableHeading: number = 0

    update(newPos: LatLon, speed: number|null) {
        // Heading
        if (this.lastPos && speed !== null && speed > MIN_SPEED) {
            const h = computeHeading(this.lastPos, newPos);

            this.headingHistory.push(h);
            if (this.headingHistory.length > MAX_HISTORY) {
                this.headingHistory.shift();
            }
        }

        this.stableHeading = modeFilter(this.headingHistory);
        this.lastPos = newPos
        return this.stableHeading
    }

    getHeading(){return this.bearingToVector(this.stableHeading)}
    getBearing(){return this.stableHeading}

    bearingToVector(degrees: number) {
        const radians = (90 - degrees) * Math.PI / 180
        return {
            x: Math.cos(radians),
            y: Math.sin(radians)
        }
    }
}

export class HeadingExp {
    lastPos: Cartesian | null = null
    currentDirection: Cartesian | null = null

    reinit(lastPos: Cartesian, newPos: Cartesian, speed: number){
        this.lastPos = lastPos
        this.currentDirection = null
        this.update(newPos, speed)
    }

    update(newPos: Cartesian, speed: number|null) {
        // Heading
        if (this.lastPos && speed !== null && speed > MIN_SPEED) {
            const dir = {x: newPos.x - this.lastPos.x, y: newPos.y - this.lastPos.y};
            if(this.currentDirection){
                this.currentDirection = smoothVector(this.currentDirection, dir, 0.15)
            }
            else this.currentDirection = dir
        }

        this.lastPos = newPos
        return this.currentDirection
    }

    getDirection(){
        return this.currentDirection
    }

    getBearing(){
        if(this.currentDirection)
            return vectorToBearing(this.currentDirection)
        else return 0
    }
}
