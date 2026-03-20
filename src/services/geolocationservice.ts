import type {EventBus} from "../eventbus.ts";

export class GeoLocationService{
    bus: EventBus
    watchId: number

    constructor(bus: EventBus) {
        this.bus = bus
        this.watchId = -1

        this.bus.on("geolocation:enable", this.enableGeolocation.bind(this))
    }

    enableGeolocation(enable: boolean) {
        if("geolocation" in navigator) {
            this.watchId = navigator.geolocation.watchPosition(
                this.trackingListener.bind(this),
                (err) => console.warn("Geolocation error:", err.message),
                {enableHighAccuracy: true}
            )
            this.bus.emit("geolocation:ready")
        }else console.warn("Geolocation not supported")
    }

    trackingListener(pos: GeolocationPosition){
        this.bus.emit("geolocation:update", pos)
    }
}