/**
 * Generated by Orval
 * Do not edit manually.
 * See `gen:api` script in package.json
 */
import type { SamlSettingsSchemaOneOf } from './samlSettingsSchemaOneOf.js';
import type { SamlSettingsSchemaOneOfThree } from './samlSettingsSchemaOneOfThree.js';

/**
 * Settings used to authenticate via SAML
 */
export type SamlSettingsSchema =
    | SamlSettingsSchemaOneOf
    | SamlSettingsSchemaOneOfThree;
