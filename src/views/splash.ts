// Splash screen
import type {EventBus} from "../eventbus.ts";

export class SplashScreen {
    bus: EventBus

    splash = document.getElementById("splash-view")!
    statsTotalLength = document.getElementById("stats-total-length")!
    statsAreaCount = document.getElementById("stats-area-count")!

    constructor(bus: EventBus) {
        this.bus = bus

        bus.on("splash:show", this.show.bind(this))
        bus.on("splash:stats", this.stats.bind(this))

        this.splash.addEventListener("click", () => {this.hideSplash()})
    }

    show(){
    }

    stats(stats: {totalLength: number, areaCount: number}) {
        console.log("Showing splash screen")
        this.statsTotalLength.textContent = `${stats.totalLength}km`
        this.statsAreaCount.textContent = `${stats.areaCount}`

        this.statsTotalLength.classList.add("fadein-fast")
        this.statsAreaCount.classList.add("fadein-fast")
    }

    hideSplash() {
        // Tell others that we are fading out
        this.bus.emit("splash:hiding")

        // Fade-out splash screen
        this.splash.classList.add("hidden");
        setTimeout(() => {
            this.splash.remove();
        }, 1200);
    }
}

