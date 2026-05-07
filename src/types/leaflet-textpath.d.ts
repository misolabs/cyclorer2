import 'leaflet';

export interface TextPathOptions {
    repeat?: boolean;
    center?: boolean;
    below?: boolean;
    offset?: number;
    orientation?: number | 'flip' | 'perpendicular';
    attributes?: Record<string, string>;
}

declare module 'leaflet' {
    interface Polyline {
        setText(text: string, options?: TextPathOptions): this;
        getText(): string | undefined;
    }
}
