import {posLatLon} from "../main.ts";
import type {LatLon, POI} from "../models/models.ts";

const dropPinDangerBtn = document.getElementById("#drop-pin-danger")!;

var poiList: POI[] = []

function dropPin(pos: LatLon, type: string) {
    poiList.push({pos: pos, type})
}

dropPinDangerBtn.addEventListener("click", () => {dropPin(posLatLon, "DANGER")})