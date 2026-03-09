// Splash screen

const splash= document.getElementById("splash-view")!
const statsTotalLength = document.getElementById("stats-total-length")!
const statsAreaCount = document.getElementById("stats-area-count")!

export function splashSetStats(totalLength: number, areaCount: number){
    statsTotalLength.textContent = `${totalLength}km`
    statsAreaCount.textContent = `${areaCount}`

    statsTotalLength.classList.add("fadein-fast")
    statsAreaCount.classList.add("fadein-fast")
}

function hideSplash() {
    // Show tracking screen
    const mapViewEl = document.getElementById("map-view")!
    mapViewEl.style.visibility = "visible"

    // Fade-out splash screen
    splash.classList.add("hidden");
    setTimeout(() => {
        splash.remove();
        // If using Leaflet:
        //trackingMap.invalidateSize();
        //areaMap.invalidateSize();
    }, 1200);
}

splash.addEventListener("click", () => {
    hideSplash();
});
