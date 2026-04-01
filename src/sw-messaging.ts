import type {EventBus} from "./eventbus.ts";

export class ServiceWorkerMessaging{
    bus: EventBus

    constructor(bus: EventBus) {
        this.bus = bus

        navigator.serviceWorker.addEventListener('message', this.swMessageListener.bind(this));

        bus.on("cache:stats:request", this.onRequestCacheStats.bind(this));
        bus.on("cache:clear", this.onClearCache.bind(this));
    }

    onClearCache(): void {
        navigator.serviceWorker.controller?.postMessage({type: "CACHE_CLEAR_TILES_REQUEST"})
    }

    onRequestCacheStats():void {
        navigator.serviceWorker.controller?.postMessage({type: "CACHE_STATS_REQUEST"})
    }

    // Listener for messages FROM service worker
    swMessageListener(event: MessageEvent){
        if(event.data.type == "CACHE_STATS")
            this.bus.emit("cache:stats", event.data);
    }
}