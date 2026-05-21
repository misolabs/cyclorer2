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

                // Check if there is rain coming in the next few hours
                if(forecast.minutely){
                    let foundRain = false
                    let when: number = 0
                    for(const minutely of forecast.minutely){
                        if(minutely.precipitation > 0){
                            foundRain = true
                            const nowSec = Date.now() / 1000
                            when = (minutely.dt - nowSec) / 60 // in minutes
                            break
                        }
                    }
                    if(!foundRain && forecast.hourly){
                        for(const hourly of forecast.hourly){
                            if(hourly.rain && hourly.rain["1h"] > 0){
                                foundRain = true
                                const nowSec = Date.now() / 1000
                                when = ((hourly.dt - nowSec) / 60) + 30 // in minutes
                                break
                            }
                        }
                    }

                    // Only show notification if it will rain in the next 6 hours
                    if(foundRain && when < 360){
                        const whenStr = when < 60 ? `${Math.round(when)} minutes` : `${Math.round(when / 60)} hours`
                        this.bus.emitEvent("notification:show", {
                            type: NotificationType.INFO,
                            caption: "Rain starting in about...",
                            description: whenStr
                        })
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