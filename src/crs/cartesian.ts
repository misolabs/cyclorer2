import type {Cartesian, SegmentDistance} from "../models/models.ts";

export function pointToSegmentDistance(P: Cartesian, A: Cartesian, B: Cartesian): SegmentDistance {
    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = P.x - A.x;
    const APy = P.y - A.y;

    // Project onto line through A and B
    const ab2 = ABx * ABx + ABy * ABy;
    const t = Math.max(0, Math.min(1,
        (APx * ABx + APy * ABy) / ab2
    ));

    // Intersection point I
    const closestX = A.x + t * ABx;
    const closestY = A.y + t * ABy;

    // Vector from P to intersection point
    const dx = P.x - closestX;
    const dy = P.y - closestY;

    return {
        distance: Math.sqrt(dx * dx + dy * dy),
        t: t,
    }
}

export function interpolateCartesian(a: Cartesian, b: Cartesian, t: number): Cartesian{
    return {
        x: a.x * t + b.x * (1 - t),
        y: a.y * t + b.y * (1 - t),
    }
}

export function accDistances(p: Cartesian[]): number{
    let lastP = p[0]
    let accDist = 0

    for(let i = 1; i < p.length; i++){
        const dx = p[i].x - lastP.x
        const dy = p[i].y - lastP.y
        accDist +=Math.sqrt(dx * dx + dy * dy)
        lastP = p[i]
    }
    return accDist
}

export function cartesianDistance(p1: Cartesian, p2: Cartesian): number{
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
}

export function cartesianDot(a: Cartesian, b: Cartesian): number {
    return a.x * b.x + a.y * b.y
}

export function cartesianLength(v: Cartesian): number {
    return Math.sqrt(v.x * v.x + v.y * v.y)
}

export function normalizeCartesian(v: Cartesian): Cartesian | null {
    const len = cartesianLength(v)
    if (len === 0) return null

    return {
        x: v.x / len,
        y: v.y / len,
    }
}
