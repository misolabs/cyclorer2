// TypeScript class hierarchy for OpenWeatherMap One Call API (current and forecast weather data)
// Reference: https://openweathermap.org/api/one-call-3?collection=one_call_api#current

// Weather condition
import type {EventBus} from "../eventbus.ts";

export class Weather {
    id!: number;
    main!: string;
    description!: string;
    icon!: string;
}

// Current weather data
export class CurrentWeather {
    dt!: number;
    sunrise?: number;
    sunset?: number;
    temp!: number;
    feels_like!: number;
    pressure!: number;
    humidity!: number;
    dew_point!: number;
    uvi!: number;
    clouds!: number;
    visibility!: number;
    wind_speed!: number;
    wind_deg!: number;
    wind_gust?: number;
    weather!: Weather[];
}

// Minutely forecast
export class MinutelyForecast {
    dt!: number;
    precipitation!: number;
}

// Hourly forecast
export class HourlyForecast {
    dt!: number;
    temp!: number;
    feels_like!: number;
    pressure!: number;
    humidity!: number;
    dew_point!: number;
    uvi!: number;
    clouds!: number;
    visibility!: number;
    wind_speed!: number;
    wind_deg!: number;
    wind_gust?: number;
    pop!: number;
    weather!: Weather[];
    rain?: { '1h': number };
    snow?: { '1h': number };
}

// Daily temperature
export class DailyTemperature {
    day!: number;
    min!: number;
    max!: number;
    night!: number;
    eve!: number;
    morn!: number;
}

// Daily feels_like
export class DailyFeelsLike {
    day!: number;
    night!: number;
    eve!: number;
    morn!: number;
}

// Daily forecast
export class DailyForecast {
    dt!: number;
    sunrise!: number;
    sunset!: number;
    moonrise!: number;
    moonset!: number;
    moon_phase!: number;
    temp!: DailyTemperature;
    feels_like!: DailyFeelsLike;
    pressure!: number;
    humidity!: number;
    dew_point!: number;
    wind_speed!: number;
    wind_deg!: number;
    wind_gust?: number;
    weather!: Weather[];
    clouds!: number;
    pop!: number;
    rain?: number;
    snow?: number;
    uvi!: number;
}

// Weather alert
export class WeatherAlert {
    sender_name!: string;
    event!: string;
    start!: number;
    end!: number;
    description!: string;
    tags!: string[];
}

// Main One Call API response
export class OneCallWeatherResponse {
    lat!: number;
    lon!: number;
    timezone!: string;
    timezone_offset!: number;
    current!: CurrentWeather;
    minutely?: MinutelyForecast[];
    hourly?: HourlyForecast[];
    daily?: DailyForecast[];
    alerts?: WeatherAlert[];
}

export class OpenWeather{
    apiKey!: string;
    baseUrl = "https://api.openweathermap.org/data/3.0"

    constructor(bus: EventBus, apiKey: string){
        this.apiKey = apiKey
    }

    /**
     * Fetches the One Call API forecast for the given latitude and longitude.
     * @param lat Latitude
     * @param lon Longitude
     * @param options Optional query parameters (e.g., units, lang, exclude)
     */
    async fetchOneCallForecast(lat: number, lon: number, options?: { units?: string; lang?: string; exclude?: string }): Promise<OneCallWeatherResponse> {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lon: lon.toString(),
            appid: this.apiKey,
        });
        if (options?.units) params.append('units', options.units);
        if (options?.lang) params.append('lang', options.lang);
        if (options?.exclude) params.append('exclude', options.exclude);
        const url = `${this.baseUrl}/onecall?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OpenWeather API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}