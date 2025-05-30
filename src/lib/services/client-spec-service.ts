import type { IUnleashConfig } from '../types/option.js';
import type { Logger } from '../logger.js';
import type { Request } from 'express';
import semver, { type SemVer } from 'semver';
import BadDataError from '../error/bad-data-error.js';
import { mustParseStrictSemVer, parseStrictSemVer } from '../util/semver.js';

export type ClientSpecFeature = 'segments' | 'deltaApi';

export class ClientSpecService {
    private readonly logger: Logger;

    private readonly clientSpecHeader = 'Unleash-Client-Spec';

    private readonly clientSpecFeatures: Record<ClientSpecFeature, SemVer> = {
        segments: mustParseStrictSemVer('4.2.0'),
        deltaApi: mustParseStrictSemVer('5.2.0'),
    };

    constructor(config: Pick<IUnleashConfig, 'getLogger'>) {
        this.logger = config.getLogger('services/capability-service.ts');
    }

    requestSupportsSpec(request: Request, feature: ClientSpecFeature): boolean {
        return this.versionSupportsSpec(
            feature,
            request.header(this.clientSpecHeader),
        );
    }

    versionSupportsSpec(
        feature: ClientSpecFeature,
        version: string | undefined,
    ): boolean {
        if (!version) {
            return false;
        }

        const parsedVersion = parseStrictSemVer(version);

        if (!parsedVersion && !/^\d/.test(version)) {
            throw new BadDataError(
                `Invalid prefix in the ${this.clientSpecHeader} header: "${version}".`,
            );
        }

        if (!parsedVersion) {
            throw new BadDataError(
                `Invalid SemVer in the ${this.clientSpecHeader} header: "${version}".`,
            );
        }

        return semver.gte(parsedVersion, this.clientSpecFeatures[feature]);
    }
}
