/**
 * Generated by Orval
 * Do not edit manually.
 * See `gen:api` script in package.json
 */
import type { VariantSchemaPayloadType } from './variantSchemaPayloadType.js';

/**
 * Extra data configured for this variant
 */
export type VariantSchemaPayload = {
    /** The type of the value. Commonly used types are string, number, json and csv. */
    type: VariantSchemaPayloadType;
    /** The actual value of payload */
    value: string;
};
