import type { EventBus } from "../eventbus.ts";
import { AnnotationRepo } from "./annotationrepo.ts";
import type {
    LocationAnnotationRequest,
    EdgeAnnotationCreateEvent,
    LatLon
} from "../models/models.ts";

export class AnnotationService {
    private bus: EventBus;
    private annotationRepo: AnnotationRepo;

    constructor(bus: EventBus) {
        this.bus = bus;
        this.annotationRepo = new AnnotationRepo(bus);

        bus.onEvent("annotation:location:create", this.onAddAnnotationRequest.bind(this));
        bus.onEvent("annotation:location:delete", this.onDeleteAnnotationRequest.bind(this));
        bus.onEvent("annotation:location:modify:pos", this.onAnnotationPositionChanged.bind(this));
        bus.onEvent("annotation:edge:save", this.onSaveEdgeAnnotation.bind(this));
        bus.onEvent("annotation:edge:delete", this.onDeleteEdgeAnnotation.bind(this));

        bus.onEvent("system:sync:requests", () => { this.annotationRepo.processQueue(); });
        bus.onEvent("system:ready", this.onSystemReady.bind(this));

        bus.onRequest("annotations:edge:get", (edge_id: string) => this.annotationRepo.findByEdgeId(edge_id));
    }

    async onSystemReady() {
        await this.annotationRepo.fetchFromServer();
        this.bus.emitEvent("annotation:location:loaded", this.annotationRepo.getAll());
        this.annotationRepo.getAllEdges().forEach((a) => {
            this.bus.emitEvent("annotation:edge:modified", a);
        });
    }

    async onAddAnnotationRequest(annotation: LocationAnnotationRequest) {
        this.annotationRepo.add(annotation);
    }

    async onDeleteAnnotationRequest(id: string) {
        await this.annotationRepo.delete(id);
    }

    onSaveEdgeAnnotation(annotation: EdgeAnnotationCreateEvent) {
        const result = this.annotationRepo.saveEdge({
            ...annotation,
            timestamp: new Date(Date.now()).toJSON()
        });
        this.bus.emitEvent("annotation:edge:modified", result);
    }

    onDeleteEdgeAnnotation(edge_id: string) {
        const annotation = this.annotationRepo.findByEdgeId(edge_id);
        if (annotation) {
            const success = this.annotationRepo.deleteEdge(edge_id);
            if (success)
                this.bus.emitEvent("annotation:edge:deleted", annotation);
        }
    }

    async onAnnotationPositionChanged(data: { id: string, pos: LatLon }) {
        const annotation = this.annotationRepo.get(data.id);
        if (annotation) {
            annotation.location = data.pos;
            this.annotationRepo.update(annotation);
        }
    }

    // Optionally expose annotationRepo for backup/sync
    getAllAnnotations() {
        return this.annotationRepo.getAll();
    }
    getAllEdges() {
        return this.annotationRepo.getAllEdges();
    }
}

