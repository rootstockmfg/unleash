import type { ClientFeaturesResponse, FeatureInterface } from '../feature.js';
import type { BootstrapProvider } from './bootstrap-provider.js';
import type { StorageProvider } from './storage-provider.js';
import type { Segment } from '../strategy/strategy.js';
import { UnleashEvents } from 'unleash-client';
import EventEmitter from 'events';

export interface RepositoryInterface {
    getToggle(name: string): FeatureInterface;
    getToggles(): FeatureInterface[];
    getSegment(id: number): Segment | undefined;
    stop(): void;
    start(): Promise<void>;
}
export interface RepositoryOptions {
    appName: string;
    bootstrapProvider: BootstrapProvider;
    storageProvider: StorageProvider<ClientFeaturesResponse>;
}

interface FeatureToggleData {
    [key: string]: FeatureInterface;
}

export default class Repository extends EventEmitter {
    private timer: NodeJS.Timeout | undefined;

    private appName: string;

    private bootstrapProvider: BootstrapProvider;

    private storageProvider: StorageProvider<ClientFeaturesResponse>;

    private data: FeatureToggleData = {};

    private segments: Map<number, Segment>;

    constructor({
        appName,
        bootstrapProvider,
        storageProvider,
    }: RepositoryOptions) {
        super();
        this.appName = appName;
        this.bootstrapProvider = bootstrapProvider;
        this.storageProvider = storageProvider;
        this.segments = new Map();
    }

    async start(): Promise<void> {
        await this.loadBootstrap();
        process.nextTick(() => this.emit(UnleashEvents.Ready));
    }

    createSegmentLookup(segments: Segment[] | undefined): Map<number, Segment> {
        if (!segments) {
            return new Map();
        }
        return new Map(segments.map((segment) => [segment.id, segment]));
    }

    async save(response: ClientFeaturesResponse): Promise<void> {
        this.data = this.convertToMap(response.features);
        this.segments = this.createSegmentLookup(response.segments);

        await this.storageProvider.set(this.appName, response);
    }

    notEmpty(content: ClientFeaturesResponse): boolean {
        return content.features.length > 0;
    }

    async loadBootstrap(): Promise<void> {
        try {
            const content = await this.bootstrapProvider.readBootstrap();

            if (content && this.notEmpty(content)) {
                await this.save(content);
            }
        } catch (err: any) {
            // intentionally left empty
        }
    }

    private convertToMap(features: FeatureInterface[]): FeatureToggleData {
        const obj = features.reduce(
            (
                o: { [s: string]: FeatureInterface },
                feature: FeatureInterface,
            ) => {
                const a = { ...o };
                a[feature.name] = feature;
                return a;
            },
            {} as { [s: string]: FeatureInterface },
        );

        return obj;
    }

    stop(): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }

    getSegment(segmentId: number): Segment | undefined {
        return this.segments.get(segmentId);
    }

    getToggle(name: string): FeatureInterface {
        return this.data[name];
    }

    getToggles(): FeatureInterface[] {
        return Object.keys(this.data).map((key) => this.data[key]);
    }
}
