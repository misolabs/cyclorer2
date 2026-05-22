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
    NotificationData, JunctionInfo, NodeId, AdjacencyInfo, EdgeIntersection, Edge
} from "./models/models.ts";
import type {TileCacheStats} from "./sw.ts";
import type {WeatherEvent} from "./weather/weatherchecker.ts";

type RequestHandler<I, O> = (input: I) => O | undefined;

type WeatherEvents={
    "weather:event": WeatherEvent,
}

type SettingsEvents = {
    "settings:init": void
    "settings:save": Settings
    "settings:loaded": Settings
    "settings:updated": Settings
    "settings:show": boolean
}

type SystemEvents = {
    "data:sync": void
    "system:sync:requests": void
    "system:ready": void

    "debug:log": string
    "debug:clear": void
}

type SplashEvents = {
    "splash:show": void
    "splash:stats": {totalLength: number, areaCount: number}
    "splash:hiding": void
}

type PowerSaveEvents = {
    // Enable powersaving mode
    "powersave:enable": void
    "powersave:disable": void
    "wakelock:engage": void
}

type GeolocationEvents = {
    // Switch on/off GPS tracking
    "geolocation:enable": void
    // Get notified on new tracking position
    "geolocation:update": GeolocationPosition
    "geolocation:ready": void
    "geolocation:riding": boolean

    // New simulation mode position available
    "geolocsim:update": LatLon
}

type NotificationEvents = {
    "notification:show": NotificationData
}

type RoutingDataEvents = {
    "rds:stats:loaded": RoutingStatsJson
    "rds:loaderror": string
    "rds:routing:loaded": GeoJsonRoutingollection
    "rds:areas:loaded": [GeoJsonAreaCollection, GeoJsonEntrypointCollection]
    "rds:annotations:loaded": LocationAnnotation[]
}

type AnnotationEvents = {
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
}

type MapEvents = {
    // Add a snailtrail segment to maps
    "map:snailtrail:add:edge": Edge
    // Clear snailtrail and set to list of edges
    "map:snailtrail:set:edges": Edge[]
    // Clear snailtrail on concerned maps
    "map:snailtrail:clear": void
}

type ExplorationEvents = {
    // We are currently riding on an unvisited path
    "exploration:started": Area
    "exploration:ended": void
    "exploration:score:updated": number
}

type NavigationEvents = {
    "navigation:target:area": Area
    "navigation:stop": void

    // New junction ahead
    "navigation:junction:upcoming": JunctionInfo
    // Updated distance to junction
    "navigation:junction:update": JunctionInfo
}

type ViewEvents = {
    "zoom:framed:area": Area
    "zoom:frame:rider": void
}

type CacheEvents = {
    "cache:stats:request": void
    "cache:stats": TileCacheStats
    "cache:clear": void
}

type AudioEvents = {
    // Play sound (one-off)
    "audio:play": string
    // Prepare a specific sound for later playback
    "audio:prepare": string
}

type Events =
    SettingsEvents &
    SystemEvents &
    SplashEvents &
    PowerSaveEvents &
    GeolocationEvents &
    NotificationEvents &
    RoutingDataEvents &
    AnnotationEvents &
    MapEvents &
    ExplorationEvents &
    NavigationEvents &
    ViewEvents &
    CacheEvents &
    AudioEvents &
    WeatherEvents

type Requests = {
    // Request the number of annotation requests pending in the request queue
    "annotations:requests:queuesize": {
        input: void
        output: number | undefined
    }
    // Request the annotation (if exists) for a given edge
    "annotations:edge:get":{
        input: string
        output: EdgeAnnotation | undefined
    }
    // Get the number of GPS sensor readings since the app was started
    "geolocation:updates:count":{
        input: void
        output: number
    }
    // Get the current GPS position
    "geolocation:current:position":{
        input: void
        output: LatLon | undefined
    }

    // Get adjacency info for a given Node
    "node:adjacency": {
        input: NodeId
        output: AdjacencyInfo[] | undefined
    }
    // Find closest graph edge to a given position
    "routing:closestedge:pos":{
        input: LatLon
        output: EdgeIntersection | undefined
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
