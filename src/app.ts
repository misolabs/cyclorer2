import 'bootstrap/dist/css/bootstrap.min.css'
import './css/icons.css'
import './css/map.css'
import './css/settings.css'
import './css/splash.css'

import {EventBus} from "./eventbus.ts";
import {SettingsService} from "./services/settingsservice.ts";
import {SettingsView} from "./views/settingsview.ts";
import {SplashScreen} from "./views/splash.ts";
import {GeoLocationService} from "./services/geolocationservice.ts";

// Heuristic to determine whether we are running on a mobile device
const isMobileLike = window.matchMedia("(pointer: coarse)").matches;

// App-wide event bus, shared by all components
export const appBus: EventBus = new EventBus()

// Create services
const settingsService: SettingsService = new SettingsService(appBus)
const geoLocationService: GeoLocationService = new GeoLocationService(appBus)

// Create views
const settingsView: SettingsView = new SettingsView("settings-view", appBus)
const splashScreen: SplashScreen = new SplashScreen(appBus)

// Show splash screen
appBus.emit("splash:show")

// Load settings or revert to default values
appBus.emit("settings:init")

// We only use GPS tracking on a mobile device
// Simulation mode on a desktop browser
if(isMobileLike)
    appBus.emit("geolocation:enable", true)

// After loading stats - Just for testing
setTimeout( () => appBus.emit("splash:stats", {totalLength: 145, areaCount: 1}), 2000)