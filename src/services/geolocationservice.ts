import type {EventBus} from "../eventbus.ts";

export interface GeolocationLight{ coords: {latitude: number, longitude: number }}

export class GeoLocationService{
    bus: EventBus
    watchId: number

    constructor(bus: EventBus) {
        this.bus = bus
        this.watchId = -1

        this.bus.on("geolocation:enable", this.enableGeolocation.bind(this))
        this.bus.on("powersave:disable", this.enableGeolocation.bind(this))
        this.bus.on("powersave:enable", this.disableGeolocation.bind(this))
    }

    enableGeolocation() {
        if("geolocation" in navigator) {
            this.watchId = navigator.geolocation.watchPosition(
                this.trackingListener.bind(this),
                (err) => console.warn("Geolocation error:", err.message),
                {enableHighAccuracy: true}
            )
            this.bus.emit("geolocation:ready")
        }else console.warn("Geolocation not supported")
    }

    disableGeolocation() {
        if("geolocation" in navigator && this.watchId > 0) {
            navigator.geolocation.clearWatch(this.watchId)
            this.watchId = -1
        }
    }

    trackingListener(pos: GeolocationPosition){
        this.bus.emit("geolocation:update", pos)
    }
}