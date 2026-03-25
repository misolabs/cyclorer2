import type {Settings} from "./services/settingsservice.ts";
import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "./models/geo.ts";
import type {GeolocationLight} from "./services/geolocationservice.ts";
import type {AnnotationCategory, Area, AreaId, LatLon, LocationAnnotation} from "./models/models.ts";

type Events = {
    "settings:init": void
    "settings:save": Settings
    "settings:loaded": Settings
    "settings:updated": Settings
    "settings:show": boolean

    "splash:show": void
    "splash:stats": {totalLength: number, areaCount: number}
    "splash:hiding": void

    "geolocation:enable": boolean
    "geolocation:update": GeolocationPosition
    "geolocation:ready": void

    "geolocsim:update": LatLon

    "debug:log": string

    "rds:stats:loaded": RoutingStatsJson
    "rds:loaderror": string
    "rds:routing:loaded": GeoJsonRoutingollection
    "rds:areas:loaded": [GeoJsonAreaCollection, GeoJsonEntrypointCollection]
    "rds:annotations:loaded": LocationAnnotation[]

    "annotation:location:add": AnnotationCategory
    "annotation:location:added": LocationAnnotation

    "exploration:started": Area
    "exploration:ended": void
    "exploration:score:updated": number

    "system:ready": void
};

export class EventBus {
    private listeners: Partial<Record<keyof Events, Function[]>> = {};

    on<K extends keyof Events>(
        event: K,
        handler: (payload: Events[K]) => void
    ) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        (this.listeners[event] as Array<(payload: Events[K]) => void>).push(handler);
    }

    emit<K extends keyof Events>(
        event: K,
        ...payload: Events[K] extends void ? [] : [Events[K]]
    ) {
        const handlers =
            this.listeners[event] as Array<(payload: Events[K]) => void> | undefined;

        if (!handlers) return;

        // ✅ key fix: narrow payload before use
        if (payload.length === 0) {
            handlers.forEach(handler => handler(undefined as Events[K]));
        } else {
            const value = payload[0]; // now correctly inferred
            handlers.forEach(handler => handler(value));
        }
    }
}