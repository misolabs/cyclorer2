import type {Settings} from "./services/settingsservice.ts";

type Events = {
    "settings:init": void
    "settings:save": Settings
    "settings:loaded": Settings
    "settings:updated": Settings
    "settings:show": boolean

    "splash:show": void
    "splash:stats": {totalLength: number, areaCount: number}
    "splash:hiding": void
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