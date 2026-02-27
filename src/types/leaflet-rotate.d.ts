declare module 'leaflet-rotate';
import 'leaflet';

declare module 'leaflet' {
    interface Map {
        setBearing(angle: number): this;
        getBearing(): number;
    }

    interface MapOptions {
        rotate?: boolean;
    }
}