import * as L from 'leaflet';

declare module 'leaflet' {
    namespace markerClusterGroup {
        interface MarkerClusterGroupOptions extends L.LayerOptions {
            showCoverageOnHover?: boolean;
            zoomToBoundsOnClick?: boolean;
            spiderfyOnMaxZoom?: boolean;
            disableClusteringAtZoom?: number;
            maxClusterRadius?: number | ((zoom: number) => number);
        }
    }

    class MarkerClusterGroup extends L.FeatureGroup {
        constructor(options?: markerClusterGroup.MarkerClusterGroupOptions);

        addLayer(layer: L.Layer): this;
        removeLayer(layer: L.Layer): this;
        clearLayers(): this;
        refreshClusters(): this;
    }

    function markerClusterGroup(
        options?: markerClusterGroup.MarkerClusterGroupOptions
    ): MarkerClusterGroup;
}
