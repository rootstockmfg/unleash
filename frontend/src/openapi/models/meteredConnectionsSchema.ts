/**
 * Generated by Orval
 * Do not edit manually.
 * See `gen:api` script in package.json
 */
import type { MeteredConnectionsSchemaApiDataItem } from './meteredConnectionsSchemaApiDataItem.js';
import type { MeteredConnectionsSchemaDateRange } from './meteredConnectionsSchemaDateRange.js';
import type { MeteredConnectionsSchemaGrouping } from './meteredConnectionsSchemaGrouping.js';

/**
 * Contains the recorded metered groups connections segmented by day/month
 */
export interface MeteredConnectionsSchema {
    /** Contains the recorded daily/monthly connections for each metered group */
    apiData: MeteredConnectionsSchemaApiDataItem[];
    /** The date range there is data for. The range is inclusive and goes from the start of the `from` date to the end of the `to` date */
    dateRange: MeteredConnectionsSchemaDateRange;
    /** Whether the data is aggregated by month or by day. */
    grouping: MeteredConnectionsSchemaGrouping;
}
