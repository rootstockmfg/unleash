/**
 * Generated by Orval
 * Do not edit manually.
 * See `gen:api` script in package.json
 */
import type { ReleasePlanMilestoneStrategySchema } from './releasePlanMilestoneStrategySchema.js';

/**
 * Schema representing the creation of a release plan milestone.
 */
export interface ReleasePlanMilestoneSchema {
    /**
     * The milestone's ID. Milestone IDs are ulids.
     */
    id: string;
    /** The name of the milestone. */
    name: string;
    /** The ID of the release plan/template that this milestone belongs to. */
    releasePlanDefinitionId: string;
    /** The order of the milestone in the release plan. */
    sortOrder: number;
    /** A list of strategies that are attached to this milestone. */
    strategies?: ReleasePlanMilestoneStrategySchema[];
}
