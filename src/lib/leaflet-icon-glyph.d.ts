import type * as L from "leaflet";

declare module "leaflet" {
  namespace Icon {
    interface GlyphOptions extends Partial<L.IconOptions> {
      glyph?: string;
      prefix?: string;
      glyphColor?: string;
      glyphSize?: string;
      glyphAnchor?: [number, number];
      markerColor?: string;
    }

    class Glyph extends L.Icon {
      constructor(options?: GlyphOptions);
    }
  }

  namespace icon {
    function glyph(options?: Icon.GlyphOptions): Icon.Glyph;
  }
}

export {};
