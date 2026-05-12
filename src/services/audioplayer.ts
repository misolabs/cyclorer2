import {NotificationType} from "../models/models.ts";
import type {EventBus} from "../eventbus.ts";

const soundUrls = new Map<string, string>([
    ["alert", `${import.meta.env.BASE_URL}assets/alert.mp3`],
    ["click", `${import.meta.env.BASE_URL}assets/click.mp3`],
])

const audioMap = new Map<string, HTMLAudioElement>(
    Array.from(soundUrls, ([name, url]) => {
        const audio = new Audio(url)
        audio.preload = "auto"
        audio.setAttribute("playsinline", "")
        return [name, audio]
    })
)

export class AudioPlayer {
    bus: EventBus
    private audioUnlocked = false

    constructor(eventBus: EventBus) {
        this.bus = eventBus

        this.bus.onEvent("audio:play", this.playSound.bind(this))
        this.bus.onEvent("audio:unlock", this.unlockAudio.bind(this))

        const unlockOnFirstGesture = () => {
            this.unlockAudio()
        }

        window.addEventListener("pointerdown", unlockOnFirstGesture, { once: true, capture: true })
        window.addEventListener("touchend", unlockOnFirstGesture, { once: true, capture: true })
        window.addEventListener("keydown", unlockOnFirstGesture, { once: true, capture: true })
    }

    unlockAudio() {
        if (this.audioUnlocked) return

        const alertAudio = audioMap.get("alert")
        if (!alertAudio) return

        alertAudio.muted = true
        alertAudio.currentTime = 0
        alertAudio.play().then(() => {
            alertAudio.pause()
            alertAudio.currentTime = 0
            alertAudio.muted = false
            this.audioUnlocked = true
        }).catch(() => {
            alertAudio.muted = false
        })
    }

    playSound(name: string) {
        const audio = audioMap.get(name)
        if (audio == undefined) return

        audio.currentTime = 0
        audio.play().catch((reason) => {
            if (!this.audioUnlocked) return

            this.bus.emitEvent("notification:show", {
                type: NotificationType.DEBUG,
                caption: "Error playing audio",
                description: String(reason),
                autocloseDelay: 3000
            })
        })
    }
}
