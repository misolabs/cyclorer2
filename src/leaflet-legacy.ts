import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// expose once
(window as any).L = L

export async function loadLegacyPlugins() {
    await import('leaflet-rotate')
    await import('leaflet.markercluster')
}

export default L