import type {EventBus} from "../eventbus.ts";

export class WakeLockService {
    private wakeLock: WakeLockSentinel | null = null;
    private enabled = false;

    async enable() {
        this.enabled = true;

        if (!('wakeLock' in navigator)) {
            console.warn('Wake Lock API not supported');
            return;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock acquired');

            this.wakeLock.addEventListener('release', () => {
                console.log('Wake lock released');
                this.wakeLock = null;
            });

        } catch (err) {
            console.error('Wake lock failed:', err);
        }
    }

    async disable() {
        this.enabled = false;

        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake lock manually released');
        }
    }

    async handleVisibilityChange() {
        if (
            this.enabled &&
            document.visibilityState === 'visible' &&
            !this.wakeLock
        ) {
            console.log('Re-acquiring wake lock...');
            await this.enable();
        }
    }
}
