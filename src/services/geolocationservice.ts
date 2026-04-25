import type {EventBus} from "../eventbus.ts";

export interface GeolocationLight{ coords: {latitude: number, longitude: number }}

export class GeoLocationService{
    bus: EventBus
    watchId: number
    riding: boolean = false

    constructor(bus: EventBus) {
        this.bus = bus
        this.watchId = -1

        this.bus.onEvent("geolocation:enable", this.enableGeolocation.bind(this))
        this.bus.onEvent("powersave:disable", this.enableGeolocation.bind(this))
        this.bus.onEvent("powersave:enable", this.disableGeolocation.bind(this))
    }

    enableGeolocation() {
        if("geolocation" in navigator) {
            this.watchId = navigator.geolocation.watchPosition(
                this.trackingListener.bind(this),
                (err) => console.warn("Geolocation error:", err.message),
                {enableHighAccuracy: true}
            )
            this.bus.emitEvent("geolocation:ready")
        }else console.warn("Geolocation not supported")
    }

    disableGeolocation() {
        if("geolocation" in navigator && this.watchId > 0) {
            navigator.geolocation.clearWatch(this.watchId)
            this.watchId = -1
        }
    }

    trackingListener(pos: GeolocationPosition){
        this.bus.emitEvent("geolocation:update", pos)

        if(pos.coords.speed){
            if(!this.riding && pos.coords.speed > 1.0){
                this.riding = true
                this.bus.emitEvent("geolocation:riding", true)
            }else if(this.riding && pos.coords.speed < 0.5){
                this.riding = false
                this.bus.emitEvent("geolocation:riding", false)
            }
        }
    }
}