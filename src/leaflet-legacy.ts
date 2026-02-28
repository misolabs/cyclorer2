import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// expose once
(window as any).L = L

export async function loadLegacyPlugins() {
    await import('leaflet-rotate')
}

export default L