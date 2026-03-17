var isUIOverlayVisible = true

export const TrackingView = {
    toggleDismissButton(show: boolean) {
    if(show)
        document.getElementById("dismiss-area-btn")!.classList.remove("hide")
    else
        document.getElementById("dismiss-area-btn")!.classList.add("hide")
},

    toggleEngageButton(show: boolean) {
    if(show)
        document.getElementById("engage-area-btn")!.classList.remove("hide")
    else
        document.getElementById("engage-area-btn")!.classList.add("hide")
},

    toggleStopNavigationButton(show: boolean) {
    if(show)
        document.getElementById("stop-navigation-btn")!.classList.remove("hide")
    else
        document.getElementById("stop-navigation-btn")!.classList.add("hide")
},

    // Hide UI when we ride
    // Elements to toggle are marked with a css class
    toggleUIOverlays(speed: number) {
        const overlayElements = document.querySelectorAll(".ui-overlay-element")
        // Slowing down -> show
        if(speed < 1.0 && !isUIOverlayVisible) {
            overlayElements.forEach(overlayElement => {
                overlayElement.classList.remove("hide")
            })
            isUIOverlayVisible = true
            // Speeding up -> hide
        }else if(speed > 2.0 && isUIOverlayVisible) {
            for(const el of overlayElements) {
                if (!el.classList.contains("hide")) {
                    el.classList.add("hide")
                }
            }
            isUIOverlayVisible = false
        }
    },

}