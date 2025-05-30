import { validateSchema } from '../validate.js';
import type { FeatureMetricsSchema } from './feature-metrics-schema.js';

test('featureMetricsSchema', () => {
    const data: FeatureMetricsSchema = {
        maturity: 'stable',
        version: 2,
        data: [
            {
                environment: 'some-env',
                timestamp: new Date(2020, 6, 1, 17, 50, 3).toISOString(),
                yes: 50,
                no: 1,
            },
        ],
    };

    expect(
        validateSchema('#/components/schemas/featureMetricsSchema', data),
    ).toBeUndefined();
});
