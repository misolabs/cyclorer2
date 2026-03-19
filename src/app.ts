import 'bootstrap/dist/css/bootstrap.min.css'
import './css/icons.css'
import './css/map.css'
import './css/settings.css'
import './css/splash.css'

import {EventBus} from "./eventbus.ts";
import {SettingsService} from "./services/settingsservice.ts";
import {SettingsView} from "./views/settingsview.ts";
import {SplashScreen} from "./views/splash.ts";

// App-wide event bus, shared by all components
export const appBus: EventBus = new EventBus()

// Create services
const settingsService: SettingsService = new SettingsService(appBus)

// Create views
const settingsView: SettingsView = new SettingsView("settings-view", appBus)
const splashScreen: SplashScreen = new SplashScreen(appBus)

// Load settings or revert to default values
appBus.emit("settings:init")

// Show splash screen
appBus.emit("splash:show")

// After loading stats - Just for testing
setTimeout( () => appBus.emit("splash:stats", {totalLength: 145, areaCount: 1}), 2000)