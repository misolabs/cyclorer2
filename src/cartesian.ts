import type {Cartesian, SegmentDistance} from "./models.ts";

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