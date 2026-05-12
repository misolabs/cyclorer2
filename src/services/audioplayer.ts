import {NotificationType} from "../models/models.ts";
import type {EventBus} from "../eventbus.ts";

const soundUrls = new Map<string, string>([
    ["alert", `${import.meta.env.BASE_URL}assets/alert.mp3`],
    ["click", `${import.meta.env.BASE_URL}assets/click.mp3`],
])

export class AudioPlayer {
    bus: EventBus
    private context: AudioContext
    private buffers = new Map<string, AudioBuffer>()
    private loading = new Map<string, Promise<AudioBuffer | undefined>>()
    private audioUnlocked = false

    constructor(eventBus: EventBus) {
        this.bus = eventBus
        this.context = new AudioContext()

        this.bus.onEvent("audio:play", this.playSound.bind(this))
        this.bus.onEvent("audio:unlock", this.unlockAudio.bind(this))

        for (const name of soundUrls.keys()) {
            void this.preloadSound(name)
        }
    }

    unlockAudio() {
        this.audioUnlocked = true

        if (this.context.state === "suspended") {
            void this.context.resume().catch(() => {
                this.audioUnlocked = false
            })
        }
    }

    playSound(name: string) {
        if (!this.audioUnlocked) return
        void this.playBuffer(name)
    }

    private async playBuffer(name: string) {
        const buffer = await this.getBuffer(name)
        if (!buffer) return

        try {
            if (this.context.state === "suspended") {
                await this.context.resume()
            }

            const source = this.context.createBufferSource()
            source.buffer = buffer
            source.connect(this.context.destination)
            source.start(0)
        } catch (reason) {
            this.bus.emitEvent("notification:show", {
                type: NotificationType.DEBUG,
                caption: "Error playing audio",
                description: String(reason),
                autocloseDelay: 3000
            })
        }
    }

    private async getBuffer(name: string) {
        const cached = this.buffers.get(name)
        if (cached) return cached

        const pending = this.loading.get(name)
        if (pending) return pending

        const loaded = this.preloadSound(name)
        this.loading.set(name, loaded)
        return loaded
    }

    private async preloadSound(name: string): Promise<AudioBuffer | undefined> {
        const cached = this.buffers.get(name)
        if (cached) return cached

        const url = soundUrls.get(name)
        if (!url) return undefined

        try {
            const response = await fetch(url)
            if (!response.ok) return undefined

            const data = await response.arrayBuffer()
            const buffer = await this.context.decodeAudioData(data)
            this.buffers.set(name, buffer)
            return buffer
        } catch {
            return undefined
        } finally {
            this.loading.delete(name)
        }
    }
}
