import type {EventBus} from "../eventbus.ts";
import {type LatLon, NotificationType} from "../models/models.ts";
import {OpenWeather, Weather} from "./openweather.ts";
import {isOwmWeatherConditionWorthAlert} from "./owm_conditions.ts";

export class WeatherEvent{
    code: string
    description: string
    whenSec: number

    constructor(code: string, description: string, whenMinutes: number) {
        this.code = code;
        this.description = description;
        this.whenSec = whenMinutes;
    }
}

export class WeatherTracker{
    bus: EventBus;
    api: OpenWeather;

    constructor(bus: EventBus) {
        this.bus = bus;
        this.api = new OpenWeather(bus, "e40e9ab8badcdc018af98185983d69ad");
    }

    async checkWeather(){
        const pos: LatLon|undefined = this.bus.request("geolocation:current:position")
console.log("Checking weather...")
        if(pos){
            try {
                const forecast = await this.api.fetchOneCallForecast(
                    pos.lat, pos.lon, {
                    exclude: "daily",
                    units: "metric"
                })

                // Check for alarms
                if (forecast.alerts) {
                    forecast.alerts.forEach(alert => {
                        this.bus.emitEvent("notification:show", {
                            type: NotificationType.INFO,
                            caption: alert.event,
                            description: alert.description,
                        })
                    })
                }

                // Alternative logic

                // First check hourly forecast if there will be any developments that warrant
                // a warning
                let foundAlert = false
                let alertCondition: Weather|undefined = undefined
                let when: number = Date.now()

                if(forecast.hourly){
                    // Only check 4 hours
                    for(const hourly of forecast.hourly.slice(0, 4)){
                        for(const condition of hourly.weather) {
                            if (isOwmWeatherConditionWorthAlert(condition.id)) {
                                foundAlert = true
                                alertCondition = condition
                                when = hourly.dt
                                break
                            }
                        }
                    }
                    if(foundAlert){
                        this.bus.emitEvent("weather:event", new WeatherEvent(
                            alertCondition?.icon ?? "",
                            alertCondition?.main ?? "Unknown alert",
                            when))
                    }
                }
            } catch (e) {
                console.error("Failed to fetch weather data", e)
                this.bus.emitEvent("notification:show", {
                    type: NotificationType.ERROR,
                    caption: "Weather check failed",
                    description: "Could not fetch weather data. Please check your connection.",
                })
            }
        }
    }
}