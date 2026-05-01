import type {Settings} from "./services/settingsservice.ts";
import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "./models/geo.ts";
import type {GeolocationLight} from "./services/geolocationservice.ts";
import type {
    LocationAnnotationCategory, Area, AreaId, EdgeAnnotation, LatLon, LocationAnnotation,
    EdgeAnnotationRequest, LocationAnnotationRequest, LocationAnnotationId, EdgeAnnotationCreateEvent,
    NotificationData
} from "./models/models.ts";
import type {TileCacheStats} from "./sw.ts";

type RequestHandler<I, O> = (input: I) => O | undefined;

type Events = {
    "settings:init": void
    "settings:save": Settings
    "settings:loaded": Settings
    "settings:updated": Settings
    "settings:show": boolean

    "data:sync": void
    "system:sync:requests": void

    "splash:show": void
    "splash:stats": {totalLength: number, areaCount: number}
    "splash:hiding": void

    "powersave:enable": void
    "powersave:disable": void
    "wakelock:engage": void
    
    "preview:minimize": void

    "geolocation:enable": void
    "geolocation:update": GeolocationPosition
    "geolocation:ready": void
    "geolocation:riding": boolean

    "geolocsim:update": LatLon

    "debug:log": string
    "debug:clear": void
    "notification:show": NotificationData

    "rds:stats:loaded": RoutingStatsJson
    "rds:loaderror": string
    "rds:routing:loaded": GeoJsonRoutingollection
    "rds:areas:loaded": [GeoJsonAreaCollection, GeoJsonEntrypointCollection]
    "rds:annotations:loaded": LocationAnnotation[]

    "annotation:location:drophere": LocationAnnotationCategory // UI button to mapview
    "annotation:location:create": LocationAnnotationRequest // UI to service
    "annotation:location:delete": LocationAnnotationId
    "annotation:location:modify:pos": {id: LocationAnnotationId, pos: LatLon}
    "annotation:location:synced": LocationAnnotation
    "annotation:location:loaded": LocationAnnotation[]

    "annotation:edge:modified": EdgeAnnotation
    "annotation:edge:save": EdgeAnnotationCreateEvent
    "annotation:edge:delete": string
    "annotation:edge:deleted": EdgeAnnotation

    "exploration:started": Area
    "exploration:ended": void
    "exploration:score:updated": number

    "navigation:target:area": Area
    "navigation:stop": void
    "area:dismiss": void
    "area:engage": void

    "zoom:framed:area": Area
    "zoom:frame:rider": void

    "system:ready": void

    "cache:stats:request": void
    "cache:stats": TileCacheStats
    "cache:clear": void
};

type Requests = {
    "annotations:requests:queuesize": {
        input: void
        output: number | undefined
    }
};

export class EventBus {
    private eventListeners: Partial<Record<keyof Events, Function[]>> = {};
    private requestListeners: Partial<{
        [K in keyof Requests]: RequestHandler<Requests[K]["input"], Requests[K]["output"]>[]
    }> = {};

    onEvent<K extends keyof Events>(
        event: K,
        handler: (payload: Events[K]) => void
    ) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }

        (this.eventListeners[event] as Array<(payload: Events[K]) => void>).push(handler);
    }

    emitEvent<K extends keyof Events>(
        event: K,
        ...payload: Events[K] extends void ? [] : [Events[K]]
    ) {
        const handlers =
            this.eventListeners[event] as Array<(payload: Events[K]) => void> | undefined;

        if (!handlers) return;

        // ✅ key fix: narrow payload before use
        if (payload.length === 0) {
            handlers.forEach(handler => handler(undefined as Events[K]));
        } else {
            const value = payload[0]; // now correctly inferred
            handlers.forEach(handler => handler(value));
        }
    }

    onRequest<K extends keyof Requests>(
        request: K,
        handler: RequestHandler<Requests[K]["input"], Requests[K]["output"]>
    ) {
        if (!this.requestListeners[request]) {
            this.requestListeners[request] = [];
        }

        (this.requestListeners[request] as RequestHandler<Requests[K]["input"], Requests[K]["output"]>[]).push(handler);
    }

    request<K extends keyof Requests>(
        request: K,
        ...payload: Requests[K]["input"] extends void ? [] : [Requests[K]["input"]]
    ): Requests[K]["output"] {
        const handlers =
            this.requestListeners[request] as RequestHandler<Requests[K]["input"], Requests[K]["output"]>[] | undefined;

        if (!handlers) return undefined as Requests[K]["output"];

        const input = (payload.length === 0 ? undefined : payload[0]) as Requests[K]["input"];

        for (const handler of handlers) {
            const result = handler(input);
            if (typeof result !== "undefined") {
                return result;
            }
        }

        return undefined as Requests[K]["output"];
    }
}
