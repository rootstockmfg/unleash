/**
 * Generated by Orval
 * Do not edit manually.
 * See `gen:api` script in package.json
 */
import type { ChangeRequestCreateSchemaOneOfThreetwoAction } from './changeRequestCreateSchemaOneOfThreetwoAction.js';
import type { ChangeRequestCreateSchemaOneOfThreetwoPayload } from './changeRequestCreateSchemaOneOfThreetwoPayload.js';

/**
 * Remove a release plan from feature environment.
 */
export type ChangeRequestCreateSchemaOneOfThreetwo = {
    /** The name of this action. */
    action: ChangeRequestCreateSchemaOneOfThreetwoAction;
    /** The name of the feature that this change applies to. */
    feature: string;
    /** The Id of the release plan to remove. */
    payload: ChangeRequestCreateSchemaOneOfThreetwoPayload;
};
