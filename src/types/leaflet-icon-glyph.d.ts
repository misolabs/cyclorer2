import "leaflet";

declare module "leaflet" {
    namespace Icon {
        interface GlyphOptions extends BaseIconOptions {
            glyph?: string;
            glyphColor?: string;
            glyphSize?: string;
            prefix?: string;
            markerColor?: string;
        }

        class Glyph extends Icon {
            constructor(options?: GlyphOptions);
        }
    }
}