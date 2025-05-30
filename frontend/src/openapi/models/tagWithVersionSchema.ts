/**
 * Generated by Orval
 * Do not edit manually.
 * See `gen:api` script in package.json
 */
import type { TagSchema } from './tagSchema.js';

/**
 * A tag with a version number representing the schema used to model the tag.
 */
export interface TagWithVersionSchema {
    tag: TagSchema;
    /** The version of the schema used to model the tag. */
    version: number;
}
