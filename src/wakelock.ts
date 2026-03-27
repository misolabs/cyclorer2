import type {EventBus} from "./eventbus.ts";

export class WakeLockFeature{
    sentinel!: WakeLockSentinel
    bus: EventBus

    constructor(bus: EventBus) {
        this.bus = bus
    }

    async setup(){
        try {
            this.sentinel = await navigator.wakeLock.request("screen")
        } catch (err) {
            // the wake lock request fails - usually system related, such being low on battery
            if(err instanceof Error) {
                console.error(`${err.name}, ${err.message}`)
                this.bus.emit("debug:log", `${err.name} - ${err.message}`)
            }
            else
                console.error(err)
        }
    }
}