import type {EventBus} from "../eventbus.ts";

export class NavigationService{
    bus: EventBus;

    constructor(bus: EventBus) {
        this.bus = bus;
    }


}