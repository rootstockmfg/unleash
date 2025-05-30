import {
    type IUnleashTest,
    setupAppWithCustomConfig,
} from '../../../helpers/test-helper.js';
import dbInit, { type ITestDb } from '../../../helpers/database-init.js';
import getLogger from '../../../../fixtures/no-logger.js';
import * as jsonpatch from 'fast-json-patch/index.mjs';
import { type IVariant, WeightType } from '../../../../../lib/types/model.js';

let app: IUnleashTest;
let db: ITestDb;

beforeAll(async () => {
    db = await dbInit('project_feature_variants_api_serial', getLogger);
    app = await setupAppWithCustomConfig(
        db.stores,
        {
            experimental: {
                flags: {
                    strictSchemaValidation: true,
                    enableLegacyVariants: true,
                },
            },
        },
        db.rawDatabase,
    );
});

afterAll(async () => {
    await app.destroy();
    await db.destroy();
});

test('Can get variants for a feature', async () => {
    const featureName = 'feature-variants';
    const variantName = 'fancy-variant';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );
    await db.stores.featureToggleStore.saveVariants('default', featureName, [
        {
            name: variantName,
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ]);
    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect(200)
        .expect((res) => {
            expect(res.body.version).toBe(1);
            expect(res.body.variants).toHaveLength(1);
            expect(res.body.variants[0].name).toBe(variantName);
        });
});

test('Trying to do operations on a non-existing feature yields 404', async () => {
    await app.request
        .get(
            '/api/admin/projects/default/features/non-existing-feature/variants',
        )
        .expect(404);
    const variants = [
        {
            name: 'variant-put-overwrites',
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ];
    await app.request
        .put('/api/admin/projects/default/features/${featureName}/variants')
        .send(variants)
        .expect(404);

    const newVariants: IVariant[] = [];
    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 700,
        weightType: WeightType.VARIABLE,
    });
    const patch = jsonpatch.generate(observer);
    await app.request
        .patch('/api/admin/projects/default/features/${featureName}/variants')
        .send(patch)
        .expect(404);
});

test('Can patch variants for a feature and get a response of new variant', async () => {
    const featureName = 'feature-variants-patch';
    const variantName = 'fancy-variant-patch';
    const expectedVariantName = 'not-so-cool-variant-name';
    const variants = [
        {
            name: variantName,
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ];

    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );
    await db.stores.featureToggleStore.saveVariants(
        'default',
        featureName,
        variants,
    );

    const observer = jsonpatch.observe(variants);
    variants[0].name = expectedVariantName;
    const patch = jsonpatch.generate(observer);

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            expect(res.body.version).toBe(1);
            expect(res.body.variants).toHaveLength(1);
            expect(res.body.variants[0].name).toBe(expectedVariantName);
        });
});

test('Can patch variants for a feature patches all environments independently', async () => {
    const featureName = 'feature-to-patch';
    const addedVariantName = 'patched-variant-name';
    const variants = (name: string) => [
        {
            name,
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ];

    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'development',
        true,
    );
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'production',
        true,
    );
    await db.stores.featureEnvironmentStore.addVariantsToFeatureEnvironment(
        featureName,
        'development',
        variants('dev-variant'),
    );
    await db.stores.featureEnvironmentStore.addVariantsToFeatureEnvironment(
        featureName,
        'production',
        variants('prod-variant'),
    );

    const patch = [
        {
            op: 'add',
            path: '/1',
            value: {
                name: addedVariantName,
                weightType: WeightType.FIX,
                weight: 50,
            },
        },
    ];

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            expect(res.body.version).toBe(1);
            expect(res.body.variants).toHaveLength(2);
            // it picks variants from the first environment (sorted by name)
            expect(res.body.variants[0].name).toBe('dev-variant');
            expect(res.body.variants[1].name).toBe(addedVariantName);
        });

    await app.request
        .get(
            `/api/admin/projects/default/features/${featureName}?variantEnvironments=true`,
        )
        .expect((res) => {
            const environments = res.body.environments;
            expect(environments).toHaveLength(2);
            const developmentVariants = environments.find(
                (x) => x.name === 'development',
            ).variants;
            const productionVariants = environments.find(
                (x) => x.name === 'production',
            ).variants;
            expect(developmentVariants).toHaveLength(2);
            expect(productionVariants).toHaveLength(2);
            expect(
                developmentVariants.find((x) => x.name === addedVariantName),
            ).toBeTruthy();
            expect(
                productionVariants.find((x) => x.name === addedVariantName),
            ).toBeTruthy();
            expect(
                developmentVariants.find((x) => x.name === 'dev-variant'),
            ).toBeTruthy();
            expect(
                productionVariants.find((x) => x.name === 'prod-variant'),
            ).toBeTruthy();
        });
});

test('Can push variants to multiple environments', async () => {
    const featureName = 'feature-to-override';
    const variant = (name: string, weight: number) => ({
        name,
        stickiness: 'default',
        weight,
        weightType: WeightType.VARIABLE,
    });
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'development',
        true,
    );
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'production',
        true,
    );
    await db.stores.featureEnvironmentStore.addVariantsToFeatureEnvironment(
        featureName,
        'development',
        [
            variant('dev-variant-1', 250),
            variant('dev-variant-2', 250),
            variant('dev-variant-3', 250),
            variant('dev-variant-4', 250),
        ],
    );
    await db.stores.featureEnvironmentStore.addVariantsToFeatureEnvironment(
        featureName,
        'production',
        [variant('prod-variant', 1000)],
    );

    const overrideWith = {
        variants: [
            variant('new-variant-1', 500),
            variant('new-variant-2', 500),
        ],
        environments: ['development', 'production'],
    };

    await app.request
        .put(
            `/api/admin/projects/default/features/${featureName}/variants-batch`,
        )
        .send(overrideWith)
        .expect(200)
        .expect((res) => {
            expect(res.body.version).toBe(1);
            expect(res.body.variants).toHaveLength(2);
            expect(res.body.variants[0].name).toBe('new-variant-1');
            expect(res.body.variants[1].name).toBe('new-variant-2');
        });

    await app.request
        .get(
            `/api/admin/projects/default/features/${featureName}?variantEnvironments=true`,
        )
        .expect((res) => {
            const environments = res.body.environments;
            expect(environments).toHaveLength(2);
            const developmentVariants = environments.find(
                (x) => x.name === 'development',
            ).variants;
            const productionVariants = environments.find(
                (x) => x.name === 'production',
            ).variants;
            expect(developmentVariants).toHaveLength(2);
            expect(productionVariants).toHaveLength(2);
            expect(developmentVariants[0].name).toBe('new-variant-1');
            expect(developmentVariants[1].name).toBe('new-variant-2');
        });
});

test("Returns proper error if project and/or feature flag doesn't exist", async () => {
    await app.request
        .put(
            `/api/admin/projects/nonexistent/features/undefined/variants-batch`,
        )
        .send({
            variants: [
                {
                    name: 'new-variant-1',
                    stickiness: 'default',
                    weight: 500,
                    weightType: WeightType.VARIABLE,
                },
            ],
            environments: ['development', 'production'],
        })
        .expect(404);
});

test('Can add variant for a feature', async () => {
    const featureName = 'feature-variants-patch-add';
    const variantName = 'fancy-variant-patch';
    const expectedVariantName = 'not-so-cool-variant-name';
    const variants = [
        {
            name: variantName,
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ];

    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    await db.stores.featureToggleStore.saveVariants(
        'default',
        featureName,
        variants,
    );

    const observer = jsonpatch.observe(variants);
    variants.push({
        name: expectedVariantName,
        stickiness: 'default',
        weight: 1000,
        weightType: WeightType.VARIABLE,
    });
    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200);

    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect((res) => {
            expect(res.body.version).toBe(1);
            expect(res.body.variants).toHaveLength(2);
            expect(
                res.body.variants.find((x) => x.name === expectedVariantName),
            ).toBeTruthy();
            expect(
                res.body.variants.find((x) => x.name === variantName),
            ).toBeTruthy();
        });
});

test('Can remove variant for a feature', async () => {
    const featureName = 'feature-variants-patch-remove';
    const variantName = 'fancy-variant-patch';
    const variants = [
        {
            name: variantName,
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ];

    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    await db.stores.featureToggleStore.saveVariants(
        'default',
        featureName,
        variants,
    );

    const observer = jsonpatch.observe(variants);
    variants.pop();
    const patch = jsonpatch.generate(observer);

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200);

    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect((res) => {
            expect(res.body.version).toBe(1);
            expect(res.body.variants).toHaveLength(0);
        });
});

test('PUT overwrites current variant on feature', async () => {
    const featureName = 'variant-put-overwrites';
    const variantName = 'overwriting-for-fun';
    const variants = [
        {
            name: variantName,
            stickiness: 'default',
            weight: 1000,
            weightType: WeightType.VARIABLE,
        },
    ];
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );
    await db.stores.featureToggleStore.saveVariants(
        'default',
        featureName,
        variants,
    );

    const newVariants: IVariant[] = [
        {
            name: 'variant1',
            stickiness: 'default',
            weight: 250,
            weightType: WeightType.FIX,
        },
        {
            name: 'variant2',
            stickiness: 'default',
            weight: 375,
            weightType: WeightType.VARIABLE,
        },
        {
            name: 'variant3',
            stickiness: 'default',
            weight: 450,
            weightType: WeightType.VARIABLE,
        },
    ];
    await app.request
        .put(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(newVariants)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants).toHaveLength(3);
        });
    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants).toHaveLength(3);
            expect(res.body.variants.reduce((a, v) => a + v.weight, 0)).toEqual(
                1000,
            );
        });
});

test('PUTing an invalid variant throws 400 exception', async () => {
    const featureName = 'variants-validation-feature';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    const invalidJson = [
        {
            name: 'variant',
            weight: 500,
            weightType: 'party',
            stickiness: 'userId',
        },
    ];
    await app.request
        .put(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(invalidJson)
        .expect(400)
        .expect((res) => {
            expect(res.body.details).toHaveLength(1);
            expect(res.body.details[0].message).toMatch(
                /.*weightType` property must be equal to one of the allowed values/,
            );
        });
});

test('Invalid variant in PATCH also throws 400 exception', async () => {
    const featureName = 'patch-validation-feature';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const invalidPatch = `[{
        "op": "add",
        "path": "/1",
        "value": {
            "name": "not-so-cool-variant-name",
            "stickiness": "default",
            "weight": 2000,
            "weightType": "variable"
        }
    }]`;

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .set('Content-Type', 'application/json')
        .send(invalidPatch)
        .expect(400)
        .expect((res) => {
            expect(res.body.details).toHaveLength(1);
            expect(res.body.details[0].message).toMatch(
                /.*weight" must be less than or equal to 1000/,
            );
        });
});

test('PATCHING with all variable weightTypes forces weights to sum to no less than 1000 minus the number of variable variants', async () => {
    const featureName = 'variants-validation-with-all-variable-weights';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const newVariants: IVariant[] = [];

    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 700,
        weightType: WeightType.VARIABLE,
    });
    let patch = jsonpatch.generate(observer);

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants).toHaveLength(1);
            expect(res.body.variants[0].weight).toEqual(1000);
        });

    newVariants.push({
        name: 'variant2',
        stickiness: 'default',
        weight: 700,
        weightType: WeightType.VARIABLE,
    });

    patch = jsonpatch.generate(observer);

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants).toHaveLength(2);
            expect(
                res.body.variants.every((x) => x.weight === 500),
            ).toBeTruthy();
        });

    newVariants.push({
        name: 'variant3',
        stickiness: 'default',
        weight: 700,
        weightType: WeightType.VARIABLE,
    });

    patch = jsonpatch.generate(observer);

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            res.body.variants.sort((v, other) => other.weight - v.weight);
            expect(res.body.variants).toHaveLength(3);
            expect(res.body.variants[0].weight).toBe(334);
            expect(res.body.variants[1].weight).toBe(333);
            expect(res.body.variants[2].weight).toBe(333);
        });

    newVariants.push({
        name: 'variant4',
        stickiness: 'default',
        weight: 700,
        weightType: WeightType.VARIABLE,
    });

    patch = jsonpatch.generate(observer);

    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants).toHaveLength(4);
            expect(
                res.body.variants.every((x) => x.weight === 250),
            ).toBeTruthy();
        });
});

test('PATCHING with no variable variants fails with 400', async () => {
    const featureName = 'variants-validation-with-no-variable-weights';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });
    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const newVariants: IVariant[] = [];

    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 900,
        weightType: WeightType.FIX,
    });

    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(400)
        .expect((res) => {
            expect(res.body.details).toHaveLength(1);
            expect(res.body.details[0].message).toEqual(
                'There must be at least one "variable" variant',
            );
        });
});

test('Patching with a fixed variant and variable variants splits remaining weight among variable variants', async () => {
    const featureName = 'variants-fixed-and-variable';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const newVariants: IVariant[] = [];
    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 900,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant2',
        stickiness: 'default',
        weight: 20,
        weightType: WeightType.VARIABLE,
    });
    newVariants.push({
        name: 'variant3',
        stickiness: 'default',
        weight: 123,
        weightType: WeightType.VARIABLE,
    });
    newVariants.push({
        name: 'variant4',
        stickiness: 'default',
        weight: 123,
        weightType: WeightType.VARIABLE,
    });
    newVariants.push({
        name: 'variant5',
        stickiness: 'default',
        weight: 123,
        weightType: WeightType.VARIABLE,
    });
    newVariants.push({
        name: 'variant6',
        stickiness: 'default',
        weight: 123,
        weightType: WeightType.VARIABLE,
    });
    newVariants.push({
        name: 'variant7',
        stickiness: 'default',
        weight: 123,
        weightType: WeightType.VARIABLE,
    });

    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200);

    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect(200)
        .expect((res) => {
            const body = res.body;
            expect(body.variants).toHaveLength(7);
            expect(
                body.variants.reduce((total, v) => total + v.weight, 0),
            ).toEqual(1000);
            body.variants.sort((a, b) => b.weight - a.weight);
            expect(
                body.variants.find((v) => v.name === 'variant1').weight,
            ).toEqual(900);
            expect(
                body.variants.find((v) => v.name === 'variant2').weight,
            ).toEqual(17);
            expect(
                body.variants.find((v) => v.name === 'variant3').weight,
            ).toEqual(17);
            expect(
                body.variants.find((v) => v.name === 'variant4').weight,
            ).toEqual(17);
            expect(
                body.variants.find((v) => v.name === 'variant5').weight,
            ).toEqual(17);
            expect(
                body.variants.find((v) => v.name === 'variant6').weight,
            ).toEqual(16);
            expect(
                body.variants.find((v) => v.name === 'variant7').weight,
            ).toEqual(16);
        });
});

test('Multiple fixed variants gets added together to decide how much weight variable variants should get', async () => {
    const featureName = 'variants-multiple-fixed-and-variable';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const newVariants: IVariant[] = [];

    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 600,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant2',
        stickiness: 'default',
        weight: 350,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant3',
        stickiness: 'default',
        weight: 350,
        weightType: WeightType.VARIABLE,
    });

    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200);
    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect(200)
        .expect((res) => {
            const body = res.body;
            expect(body.variants).toHaveLength(3);
            expect(
                body.variants.find((v) => v.name === 'variant3').weight,
            ).toEqual(50);
        });
});

test('If sum of fixed variant weight exceed 1000 fails with 400', async () => {
    const featureName = 'variants-fixed-weight-over-1000';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const newVariants: IVariant[] = [];

    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 900,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant2',
        stickiness: 'default',
        weight: 900,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant3',
        stickiness: 'default',
        weight: 350,
        weightType: WeightType.VARIABLE,
    });

    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(400)
        .expect((res) => {
            expect(res.body.details).toHaveLength(1);
            expect(res.body.details[0].message).toEqual(
                'The traffic distribution total must equal 100%',
            );
        });
});

test('If sum of fixed variant weight equals 1000 variable variants gets weight 0', async () => {
    const featureName = 'variants-fixed-weight-equals-1000-no-variable-weight';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const newVariants: IVariant[] = [];

    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        stickiness: 'default',
        weight: 900,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant2',
        stickiness: 'default',
        weight: 100,
        weightType: WeightType.FIX,
    });
    newVariants.push({
        name: 'variant3',
        stickiness: 'default',
        weight: 350,
        weightType: WeightType.VARIABLE,
    });
    newVariants.push({
        name: 'variant4',
        stickiness: 'default',
        weight: 350,
        weightType: WeightType.VARIABLE,
    });

    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200);
    await app.request
        .get(`/api/admin/projects/default/features/${featureName}/variants`)
        .expect(200)
        .expect((res) => {
            const body = res.body;
            expect(body.variants).toHaveLength(4);
            expect(
                body.variants.find((v) => v.name === 'variant3').weight,
            ).toEqual(0);
            expect(
                body.variants.find((v) => v.name === 'variant4').weight,
            ).toEqual(0);
        });
});

test('PATCH endpoint validates uniqueness of variant names', async () => {
    const featureName = 'variants-uniqueness-names';
    const variants = [
        {
            name: 'variant1',
            weight: 1000,
            weightType: WeightType.VARIABLE,
            stickiness: 'default',
        },
    ];
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    await db.stores.featureToggleStore.saveVariants(
        'default',
        featureName,
        variants,
    );

    const newVariants: IVariant[] = [];

    const observer = jsonpatch.observe(newVariants);
    newVariants.push({
        name: 'variant1',
        weight: 550,
        weightType: WeightType.VARIABLE,
        stickiness: 'default',
    });
    newVariants.push({
        name: 'variant2',
        weight: 550,
        weightType: WeightType.VARIABLE,
        stickiness: 'default',
    });
    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(400)
        .expect((res) => {
            expect(res.body.details[0].message).toMatch(
                /contains a duplicate value/,
            );
        });
});

test('PUT endpoint validates uniqueness of variant names', async () => {
    const featureName = 'variants-put-uniqueness-names';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    await app.request
        .put(`/api/admin/projects/default/features/${featureName}/variants`)
        .send([
            {
                name: 'variant1',
                weightType: WeightType.VARIABLE,
                weight: 500,
                stickiness: 'default',
            },
            {
                name: 'variant1',
                weightType: WeightType.VARIABLE,
                weight: 500,
                stickiness: 'default',
            },
        ])
        .expect(400)
        .expect((res) => {
            expect(res.body.details[0].message).toMatch(
                /contains a duplicate value/,
            );
        });
});

test('Variants should be sorted by their name when PUT', async () => {
    const featureName = 'variants-sort-by-name';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    await app.request
        .put(`/api/admin/projects/default/features/${featureName}/variants`)
        .send([
            {
                name: 'zvariant',
                weightType: WeightType.VARIABLE,
                weight: 500,
                stickiness: 'default',
            },
            {
                name: 'variant-a',
                weightType: WeightType.VARIABLE,
                weight: 500,
                stickiness: 'default',
            },
            {
                name: 'g-variant',
                weightType: WeightType.VARIABLE,
                weight: 500,
                stickiness: 'default',
            },
            {
                name: 'variant-g',
                weightType: WeightType.VARIABLE,
                weight: 500,
                stickiness: 'default',
            },
        ])
        .expect(200)
        .expect((res) => {
            expect(res.body.variants[0].name).toBe('g-variant');
            expect(res.body.variants[1].name).toBe('variant-a');
            expect(res.body.variants[2].name).toBe('variant-g');
            expect(res.body.variants[3].name).toBe('zvariant');
        });
});

test('Variants should be sorted by name when PATCHed as well', async () => {
    const featureName = 'variants-patch-sort-by-name';
    await db.stores.featureToggleStore.create('default', {
        name: featureName,
        createdByUserId: 9999,
    });

    await db.stores.featureEnvironmentStore.addEnvironmentToFeature(
        featureName,
        'default',
        true,
    );

    const variants: IVariant[] = [];
    const observer = jsonpatch.observe(variants);
    variants.push({
        name: 'g-variant',
        weightType: WeightType.VARIABLE,
        weight: 500,
        stickiness: 'default',
    });
    variants.push({
        name: 'a-variant',
        weightType: WeightType.VARIABLE,
        weight: 500,
        stickiness: 'default',
    });
    const patch = jsonpatch.generate(observer);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(patch)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants[0].name).toBe('a-variant');
            expect(res.body.variants[1].name).toBe('g-variant');
        });
    variants.push({
        name: '00-variant',
        weightType: WeightType.VARIABLE,
        weight: 500,
        stickiness: 'default',
    });
    variants.push({
        name: 'z-variant',
        weightType: WeightType.VARIABLE,
        weight: 500,
        stickiness: 'default',
    });
    const secondPatch = jsonpatch.generate(observer);
    expect(secondPatch).toHaveLength(2);
    await app.request
        .patch(`/api/admin/projects/default/features/${featureName}/variants`)
        .send(secondPatch)
        .expect(200)
        .expect((res) => {
            expect(res.body.variants).toHaveLength(4);
            expect(res.body.variants[0].name).toBe('00-variant');
            expect(res.body.variants[1].name).toBe('a-variant');
            expect(res.body.variants[2].name).toBe('g-variant');
            expect(res.body.variants[3].name).toBe('z-variant');
        });
});
