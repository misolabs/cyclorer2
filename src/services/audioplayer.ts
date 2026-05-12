import {NotificationType} from "../models/models.ts";
import type {EventBus} from "../eventbus.ts";

const soundUrls = new Map<string, string>([
    ["alert", `${import.meta.env.BASE_URL}assets/alert.mp3`],
    ["click", `${import.meta.env.BASE_URL}assets/click.mp3`],
])

/**
 * iOS Safari is strict about media playback: a later async `play()` call is
 * only reliable if the underlying HTMLAudioElement was already primed by a
 * real user gesture.
 *
 * This service keeps one long-lived element per sound name and separates the
 * concerns:
 * - `audio:prepare` is called from a gesture and primes that specific sound.
 * - `audio:play` reuses the prepared element later from async code.
 *
 * The extra state is intentional; it avoids recreating audio elements at the
 * moment we need them, which is where iOS tends to block playback.
 */
function createAudio(url: string): HTMLAudioElement {
    const audio = new Audio(url)
    audio.preload = "auto"
    audio.setAttribute("playsinline", "")
    return audio
}

export class AudioPlayer {
    bus: EventBus
    private sounds = new Map<string, HTMLAudioElement>()
    private prepared = new Set<string>()

    constructor(eventBus: EventBus) {
        this.bus = eventBus

        for (const [name, url] of soundUrls.entries()) {
            this.sounds.set(name, createAudio(url))
        }

        this.bus.onEvent("audio:play", this.playSound.bind(this))
        this.bus.onEvent("audio:prepare", this.prepareSound.bind(this))
    }

    /**
     * Prime one named sound while we are inside a user-initiated event.
     * On iOS this gives the browser a concrete media element to authorize.
     */
    prepareSound(name: string) {
        const audio = this.sounds.get(name)
        if (!audio) return
        if (this.prepared.has(name)) return

        audio.muted = true
        audio.currentTime = 0
        audio.play()
            .then(() => {
                audio.pause()
                audio.currentTime = 0
                audio.muted = false
                this.prepared.add(name)
            })
            .catch(() => {
                audio.muted = false
            })
    }

    /**
     * Play a previously prepared sound. If the sound was never prepared on a
     * user gesture, iOS may reject the playback request.
     */
    playSound(name: string) {
        const audio = this.sounds.get(name)
        if (!audio) return

        audio.currentTime = 0
        audio.play().catch((reason) => {
            if (!this.prepared.has(name)) return

            this.bus.emitEvent("notification:show", {
                type: NotificationType.DEBUG,
                caption: "Error playing audio",
                description: String(reason),
                autocloseDelay: 3000
            })
        })
    }
}
