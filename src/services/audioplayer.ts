import {NotificationType} from "../models/models.ts";
import type {EventBus} from "../eventbus.ts";

const alertSound = new Audio(`${import.meta.env.BASE_URL}assets/alert.mp3`)
const clickSound = new Audio(`${import.meta.env.BASE_URL}assets/click.mp3`)

const audioMap: Map<string, HTMLAudioElement> = new Map([
    ["alert", alertSound],
    ["click", clickSound]
])

export class AudioPlayer {
    bus: EventBus

    constructor(eventBus: EventBus) {
        this.bus = eventBus;

        this.bus.onEvent("audio:play", this.playSound.bind(this));
    }

    playSound(name: string) {
        const audio = audioMap.get(name)
        if (audio == undefined) return

        audio.currentTime = 0
        audio.play().catch((reason) => {
            this.bus.emitEvent("notification:show", {
                type: NotificationType.DEBUG,
                caption: "Error playing audio",
                description: reason,
                autocloseDelay: 3000
            })
        })

    }
}