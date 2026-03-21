import type {EventBus} from "../eventbus.ts";
import type {AnnotationCategory, LatLon, LocationAnnotation} from "../models/models.ts";

export class NavigationService{
    bus: EventBus;
    currentPosition!: LatLon

    constructor(bus: EventBus) {
        this.bus = bus;

        bus.on("geolocation:update", this.onGeoPositionChanged.bind(this))
        bus.on("geolocsim:update", this.onGeoSimPositionChanged.bind(this))
        bus.on("annotation:location:add", this.onAddAnnotationRequest.bind(this))
    }

    // Position update from simulation mode
    onGeoSimPositionChanged(p: LatLon){
        this.currentPosition = p
    }

    // Position update from GPS
    onGeoPositionChanged(geo: GeolocationPosition) {
        this.currentPosition = {lat: geo.coords.latitude, lon: geo.coords.longitude};
    }

    onAddAnnotationRequest(category: AnnotationCategory){
        // TODO Add to repostory
        const annotation: LocationAnnotation = {location: this.currentPosition, category: category}
        // Tell everyone about this one
        this.bus.emit("annotation:location:added", annotation)
    }
}