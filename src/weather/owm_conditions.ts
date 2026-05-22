// OpenWeather condition codes from:
// https://openweathermap.org/api/weather-conditions#Weather-Condition-Codes-2

export const OwmWeatherConditionCode = {
    // 2xx Thunderstorm
    ThunderstormWithLightRain: 200,
    ThunderstormWithRain: 201,
    ThunderstormWithHeavyRain: 202,
    LightThunderstorm: 210,
    Thunderstorm: 211,
    HeavyThunderstorm: 212,
    RaggedThunderstorm: 221,
    ThunderstormWithLightDrizzle: 230,
    ThunderstormWithDrizzle: 231,
    ThunderstormWithHeavyDrizzle: 232,

    // 3xx Drizzle
    LightIntensityDrizzle: 300,
    Drizzle: 301,
    HeavyIntensityDrizzle: 302,
    LightIntensityDrizzleRain: 310,
    DrizzleRain: 311,
    HeavyIntensityDrizzleRain: 312,
    ShowerRainAndDrizzle: 313,
    HeavyShowerRainAndDrizzle: 314,
    ShowerDrizzle: 321,

    // 5xx Rain
    LightRain: 500,
    ModerateRain: 501,
    HeavyIntensityRain: 502,
    VeryHeavyRain: 503,
    ExtremeRain: 504,
    FreezingRain: 511,
    LightIntensityShowerRain: 520,
    ShowerRain: 521,
    HeavyIntensityShowerRain: 522,
    RaggedShowerRain: 531,

    // 6xx Snow
    LightSnow: 600,
    Snow: 601,
    HeavySnow: 602,
    Sleet: 611,
    LightShowerSleet: 612,
    ShowerSleet: 613,
    LightRainAndSnow: 615,
    RainAndSnow: 616,
    LightShowerSnow: 620,
    ShowerSnow: 621,
    HeavyShowerSnow: 622,

    // 7xx Atmosphere
    Mist: 701,
    Smoke: 711,
    Haze: 721,
    SandDustWhirls: 731,
    Fog: 741,
    Sand: 751,
    Dust: 761,
    VolcanicAsh: 762,
    Squalls: 771,
    Tornado: 781,

    // 800 Clear
    ClearSky: 800,

    // 80x Clouds
    FewClouds: 801,
    ScatteredClouds: 802,
    BrokenClouds: 803,
    OvercastClouds: 804,
} as const

export type OwmWeatherConditionCode =
    typeof OwmWeatherConditionCode[keyof typeof OwmWeatherConditionCode]

/**
 * Returns true when a weather condition should trigger an alert for a rider.
 *
 * This intentionally includes the severe / high-risk conditions we discussed:
 * thunderstorms, tornadoes, freezing rain, sleet, heavy snow, stronger rain
 * showers, fog, and squalls.
 *
 * It intentionally excludes light and moderate rain.
 */
export function isOwmWeatherConditionWorthAlert(code: number): boolean {
    switch (code) {
        // Thunderstorms
        case OwmWeatherConditionCode.ThunderstormWithLightRain:
        case OwmWeatherConditionCode.ThunderstormWithRain:
        case OwmWeatherConditionCode.ThunderstormWithHeavyRain:
        case OwmWeatherConditionCode.LightThunderstorm:
        case OwmWeatherConditionCode.Thunderstorm:
        case OwmWeatherConditionCode.HeavyThunderstorm:
        case OwmWeatherConditionCode.RaggedThunderstorm:
        case OwmWeatherConditionCode.ThunderstormWithLightDrizzle:
        case OwmWeatherConditionCode.ThunderstormWithDrizzle:
        case OwmWeatherConditionCode.ThunderstormWithHeavyDrizzle:

        // Rain: above light/moderate
        case OwmWeatherConditionCode.HeavyIntensityRain:
        case OwmWeatherConditionCode.VeryHeavyRain:
        case OwmWeatherConditionCode.ExtremeRain:
        case OwmWeatherConditionCode.FreezingRain:
        case OwmWeatherConditionCode.LightIntensityShowerRain:
        case OwmWeatherConditionCode.ShowerRain:
        case OwmWeatherConditionCode.HeavyIntensityShowerRain:
        case OwmWeatherConditionCode.RaggedShowerRain:

        // Snow / mixed precipitation
        case OwmWeatherConditionCode.HeavySnow:
        case OwmWeatherConditionCode.Sleet:
        case OwmWeatherConditionCode.LightShowerSleet:
        case OwmWeatherConditionCode.ShowerSleet:
        case OwmWeatherConditionCode.LightRainAndSnow:
        case OwmWeatherConditionCode.RainAndSnow:
        case OwmWeatherConditionCode.LightShowerSnow:
        case OwmWeatherConditionCode.ShowerSnow:
        case OwmWeatherConditionCode.HeavyShowerSnow:

        // Atmosphere / wind / extreme
        case OwmWeatherConditionCode.Fog:
        case OwmWeatherConditionCode.Squalls:
        case OwmWeatherConditionCode.Tornado:
            return true

        // Warn-level snow / ice
        case OwmWeatherConditionCode.LightSnow:
        case OwmWeatherConditionCode.Snow:
        case OwmWeatherConditionCode.Mist:
        case OwmWeatherConditionCode.Haze:
            return true

        // Everything else stays silent, including light/moderate rain.
        default:
            return false
    }
}
