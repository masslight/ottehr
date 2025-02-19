import { ZambdaInput } from 'zambda-utils';
import { SubmitLabOrder } from '.';

// temp for testing
const sampleOI = {
  lab: {
    labGuid: '62f42fca-a28c-4b93-b8c1-bc5dd92bc86c',
    labName: 'BioReference Laboratories',
    labType: 'Laboratory',
    compendiumVersion: 'H70olhfCa4.ZWawbxUKwutUAPONYxMO1',
  },
  item: {
    itemCode: '0024-0',
    itemLoinc: null,
    itemType: 'Lab Test',
    itemName: 'Insulin Tolerance (3 Hour)',
    uniqueName: '0024-0_Insulin Tolerance (3 Hour)',
    specimens: [
      {
        container:
          'Red-top tube, gel-barrier tube, OR green-top (lithium heparin) tube. Do NOT use oxalate, EDTA, or citrate plasma.',
        volume: '2 mL',
        minimumVolume: '0.7 mL (NOTE:This volume does NOT allow for repeat testing.)',
        storageRequirements: 'Room temperature',
        collectionInstructions:
          'If a red-top tube or plasma tube is used, transfer separated serum or plasma to a plastic transport tube.',
      },
    ],
    components: [
      {
        componentItemCode: '1648-5',
        name: 'Insulin, Fasting',
        loinc: '27873-9',
        uom: 'uIU/mL',
        range: null,
        type: null,
      },
      {
        componentItemCode: '1649-3',
        name: 'Insulin, 1st HR. Specimen',
        loinc: '27379-7',
        uom: 'uIU/mL',
        range: null,
        type: null,
      },
      {
        componentItemCode: '1650-1',
        name: 'INSULIN, 2 HR',
        loinc: '27826-7',
        uom: 'uIU/mL',
        range: null,
        type: null,
      },
      {
        componentItemCode: '1651-9',
        name: 'INSULIN, 3rd HR. SPECIMEN',
        loinc: '27828-3',
        uom: 'uIU/mL',
        range: null,
        type: null,
      },
    ],
    cptCodes: [
      {
        cptCode: '83525',
        serviceUnitsCount: null,
      },
    ],
    aoe: {
      resourceType: 'Questionnaire',
      status: 'active',
      url: 'https://labs.fhir.oystehr.com/lab/62f42fca-a28c-4b93-b8c1-bc5dd92bc86c/compendium/H70olhfCa4.ZWawbxUKwutUAPONYxMO1/order/0024-0/questionnaire',
      item: [
        {
          linkId: 'vzwlYjZkUcBZl_YpKGg-vg',
          text: 'Are the specimen tubes labeled with the appropriate times?',
          type: 'boolean',
          required: true,
          code: [
            {
              system: '62f42fca-a28c-4b93-b8c1-bc5dd92bc86c-original-question-code',
              code: 'SPEC',
            },
          ],
        },
      ],
    },
  },
};

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrder {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { dx, patientId, encounter, location, practitionerId, pscHold } = JSON.parse(input.body);
  const orderableItem = sampleOI; // todo this will come from the input once oystehr labs is live

  const missingResources = [];
  if (!dx) missingResources.push('dx');
  if (!patientId) missingResources.push('patientId');
  if (!encounter) missingResources.push('encounter');
  if (!location) missingResources.push('location');
  if (!practitionerId) missingResources.push('practitionerId');
  if (!orderableItem) missingResources.push('orderableItem');
  if (missingResources.length) {
    throw new Error(`missing required resource(s): ${missingResources.join(',')}`);
  }

  return {
    dx,
    patientId,
    encounter,
    location,
    practitionerId,
    orderableItem,
    pscHold,
    secrets: input.secrets,
  };
}
