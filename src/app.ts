import 'bootstrap/dist/css/bootstrap.min.css'
import './css/common.css'
import './css/map.css'
import './css/settings.css'
import './css/splash.css'
import './css/inride_menu.css'

import {EventBus} from "./eventbus.ts";

import {SettingsView} from "./views/settingsview.ts";
import {SplashScreen} from "./views/splash.ts";
import {TrackingView} from "./views/trackingview.ts";

import {SettingsService} from "./services/settingsservice.ts";
import {GeoLocationService} from "./services/geolocationservice.ts";
import {RoutingDataService} from "./services/routingdataservice.ts";

// Prepare leaflet and plugins
import { loadLegacyPlugins } from './leaflet-legacy'
import {NavigationService} from "./services/navigationservice.ts";
import {InRideMenu} from "./views/inridemenu.ts";
import {DebugOverlay} from "./views/debugoverlay.ts";
await loadLegacyPlugins()

// Heuristic to determine whether we are running on a mobile device
const isMobileLike = window.matchMedia("(pointer: coarse)").matches;
//const isMobileLike = true

// App-wide event bus, shared by all components
const appBus: EventBus = new EventBus()

// Register service worker if possible
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/cyclorer2/sw.js', {
            scope: '/cyclorer2/',
        })
            .then(reg => {
                console.log('SW registered:', reg.scope);
            })
            .catch(err => {
                console.error('SW registration failed:', err);
            });
    });
}

// Create services
const settingsService: SettingsService = new SettingsService(appBus)
const geoLocationService: GeoLocationService = new GeoLocationService(appBus)
const routingDataService: RoutingDataService = new RoutingDataService(appBus)
const navigationService: NavigationService = new NavigationService(appBus)

// Create views
const inrideMenu: InRideMenu = new InRideMenu(appBus)
const debugOverlay = new DebugOverlay("debug", appBus)

const settingsView: SettingsView = new SettingsView("settings-view", appBus)
const splashScreen: SplashScreen = new SplashScreen(appBus)
const trackingView = new TrackingView(appBus, isMobileLike)
trackingView.init()
inrideMenu.init()

// Show splash screen
appBus.emit("splash:show")

// Load settings or revert to default values
settingsService.initSettings()

// We only use GPS tracking on a mobile device
// Simulation mode on a desktop browser
if(isMobileLike)
    appBus.emit("geolocation:enable", true)

// Async loading of all geo-data files
await routingDataService.loadRegionData("ellergronn")

// All ready
appBus.emit("system:ready")

// Bridge between
navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Message from SW:', event.data);
    if(event.data.type == "CACHE_STATS")
        appBus.emit("cache:stats", event.data);
});
console.log("event send to sw")
navigator.serviceWorker.controller?.postMessage({type: "CACHE_STATS_REQUEST"})