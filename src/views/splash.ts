// Splash screen
import type {EventBus} from "../eventbus.ts";
import type {RoutingStatsJson} from "../models/geo.ts";

export class SplashScreen {
    bus: EventBus

    splash = document.getElementById("splash-view")!
    statsTotalLength = document.getElementById("stats-total-length")!
    statsAreaCount = document.getElementById("stats-area-count")!

    constructor(bus: EventBus) {
        this.bus = bus

        bus.onEvent("splash:show", this.show.bind(this))
        bus.onEvent("rds:stats:loaded", this.stats.bind(this))

        this.splash.addEventListener("click", () => {
            this.bus.emitEvent("audio:play", "click")
            this.hideSplash()
            bus.emitEvent("wakelock:engage")
        })

        // Fetch and display build timestamp
        const tsElem = document.getElementById("build-timestamp")
        if (tsElem) {
            fetch(import.meta.env.BASE_URL + "build-timestamp.json")
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.timestamp) {
                        tsElem.textContent = `Build: ${data.timestamp}`;
                    }
                })
                .catch(() => {/* ignore */});
        }
    }

    // Does currently nothing, splash screen is visible by default
    show(){
    }

    // Show stats only after they have been loaded
    stats(stats: RoutingStatsJson) {
        this.statsTotalLength.textContent = `${stats.total_length}km`
        this.statsAreaCount.textContent = `${stats.areas}`

        // Fade-in for visual effect
        this.statsTotalLength.classList.add("fadein-fast")
        this.statsAreaCount.classList.add("fadein-fast")
    }

    hideSplash() {
        // Tell others that we are fading out
        this.bus.emitEvent("splash:hiding")

        // Fade-out splash screen
        this.splash.classList.add("hidden");
        setTimeout(() => {
            this.splash.remove();
        }, 1200);
    }
}

