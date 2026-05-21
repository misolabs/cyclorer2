import type {EventBus} from "../eventbus.ts";
import {type LatLon, NotificationType} from "../models/models.ts";
import {OpenWeather} from "./openweather.ts";

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
                const forecast = await this.api.fetchOneCallForecast(pos.lat, pos.lon, {
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

                if(forecast.hourly && forecast.hourly.length > 0) {
                    forecast.hourly?.forEach(hour => {
                        if(hour.rain && hour.rain["1h"] > 0){
                            const date = new Date(hour.dt * 1000)
                            this.bus.emitEvent("notification:show", {
                                type: NotificationType.INFO,
                                caption: `Rain expected at ${date.getHours()}:00`,
                                description: `Precipitation: ${hour.rain["1h"]} mm/h`,
                            })
                        }

                        if(hour.snow && hour.snow["1h"] > 0) {
                            const date = new Date(hour.dt * 1000)
                            this.bus.emitEvent("notification:show", {
                                type: NotificationType.INFO,
                                caption: `Snow expected at ${date.getHours()}:00`,
                                description: `Snowfall: ${hour.snow["1h"]} mm/h`,
                            })
                        }
                    })
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