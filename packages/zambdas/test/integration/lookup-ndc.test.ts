import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Medication } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { LookupNdcResponse } from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NdcProduct } from '../../src/ehr/configuration/in-house-medications/lookup-ndc/helpers';
import { index } from '../../src/ehr/configuration/in-house-medications/lookup-ndc/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { fetchNdcProduct } = vi.hoisted(() => ({ fetchNdcProduct: vi.fn() }));

vi.mock('../../src/ehr/configuration/in-house-medications/lookup-ndc/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/configuration/in-house-medications/lookup-ndc/helpers')>()),
  fetchNdcProduct,
}));

const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm';

describe('lookup-ndc integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let catalog: Medication;
  const rxcui = `${Date.now()}`.slice(-7);

  beforeAll(async () => {
    const setup = await setupIntegrationTest('lookup-ndc.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    catalog = await oystehr.fhir.create<Medication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Medication',
          identifier: [
            { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
            { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: `IT Ondansetron ${randomUUID().slice(0, 8)}` },
          ],
          code: { coding: [{ system: RXNORM_SYSTEM, code: rxcui }] },
          status: 'active',
        },
        setup.processId
      ) as Medication
    );
  }, 60_000);

  afterAll(async () => {
    if (catalog?.id) await oystehr.fhir.delete({ resourceType: 'Medication', id: catalog.id }).catch(() => undefined);
    await cleanup();
  });

  it('matches the openFDA product against the catalog drug by RxCUI', async () => {
    const product: NdcProduct = {
      packageNdc: '0409-4888-02',
      name: 'Ondansetron 2 mg/mL injection',
      genericName: 'Ondansetron',
      manufacturer: 'Hospira, Inc.',
      packageDescription: '25 VIAL in 1 CARTON',
      rxcuis: [rxcui],
    };
    fetchNdcProduct.mockResolvedValueOnce(product);

    const { statusCode, output } = await invokeZambdaHandler<LookupNdcResponse>(
      index,
      { ndc: '0409-4888-02', medicationId: catalog.id },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(fetchNdcProduct).toHaveBeenCalledWith(['0409-4888-02']);
    expect(output).toEqual({ status: 'match', comparedBy: 'rxcui', product });
  });
});
