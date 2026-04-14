import type {Settings} from "./services/settingsservice.ts";
import type {
    GeoJsonAreaCollection,
    GeoJsonEntrypointCollection,
    GeoJsonRoutingollection,
    RoutingStatsJson
} from "./models/geo.ts";
import type {GeolocationLight} from "./services/geolocationservice.ts";
import type {AnnotationCategory, Area, AreaId, EdgeAnnotation, LatLon, LocationAnnotation} from "./models/models.ts";
import type {TileCacheStats} from "./sw.ts";

type Events = {
    "settings:init": void
    "settings:save": Settings
    "settings:loaded": Settings
    "settings:updated": Settings
    "settings:show": boolean

    "data:sync": void

    "splash:show": void
    "splash:stats": {totalLength: number, areaCount: number}
    "splash:hiding": void

    "wakelock:engage": void
    
    "preview:minimize": void

    "geolocation:enable": boolean
    "geolocation:update": GeolocationPosition
    "geolocation:ready": void

    "geolocsim:update": LatLon

    "debug:log": string
    "debug:clear": void

    "rds:stats:loaded": RoutingStatsJson
    "rds:loaderror": string
    "rds:routing:loaded": GeoJsonRoutingollection
    "rds:areas:loaded": [GeoJsonAreaCollection, GeoJsonEntrypointCollection]
    "rds:annotations:loaded": LocationAnnotation[]

    "annotation:location:marker:create": AnnotationCategory
    "annotation:location:text:create": AnnotationCategory
    "annotation:location:added": LocationAnnotation
    "annotation:location:delete": number
    "annotation:location:modify:pos": {id: number, pos: LatLon}

    "annotation:edge:added": EdgeAnnotation

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