import { QuestionnaireItem } from 'fhir/r4b';
import { OrderableItemSearchResult } from 'utils';

export type MockLabResultAeoAnswerConfig = { [key: string]: { type: QuestionnaireItem['type']; answer: any } };

export type MockLabResult = {
  [key: string]: {
    labsData: OrderableItemSearchResult;
    searchTerm: string;
    aoeAnswers: MockLabResultAeoAnswerConfig;
  };
};

export const MOCK_LAB_RESULTS: MockLabResult = {
  withAoe: {
    labsData: {
      lab: {
        labGuid: '790b282d-77e9-4697-9f59-0cef8238033a',
        labName: 'AutoLab',
        labType: 'Laboratory',
        compendiumVersion: 'IEwOD5aYRdOOdp_miWkefa04RuJAMJ_c',
      },
      item: {
        itemCode: '57021-8',
        itemLoinc: '57021-8',
        itemType: 'Lab Test',
        itemName: 'CBC W Auto Differential panel in Blood',
        uniqueName: '57021-8_CBC W Auto Differential panel in Blood',
        specimens: [
          {
            container: 'serum separator tube',
            volume: '2 mL',
            minimumVolume: null,
            storageRequirements: 'Refrigerated',
            collectionInstructions: null,
          },
          {
            container: 'whole blood',
            volume: '2 mL',
            minimumVolume: null,
            storageRequirements: 'Refrigerated',
            collectionInstructions: null,
          },
        ],
        components: [
          {
            componentItemCode: '6690-2',
            name: 'WBC',
            loinc: '6690-2',
            uom: 'mg/dl',
            range: '4000-11000',
            type: 'List',
          },
          {
            componentItemCode: '789-8',
            name: 'RBC',
            loinc: '789-8',
            uom: 'mg/dl',
            range: '4.5-5.9M',
            type: 'List',
          },
          {
            componentItemCode: '718-7',
            name: 'Hemoglobin [Mass/volume] in Blood',
            loinc: '718-7',
            uom: 'g/dl',
            range: '12-15',
            type: 'List',
          },
          {
            componentItemCode: '4544-3',
            name: 'Hemotocrit',
            loinc: '4544-3',
            uom: '%',
            range: '55-66',
            type: 'List',
          },
        ],
        cptCodes: [
          {
            cptCode: '85025',
            serviceUnitsCount: null,
          },
        ],
        aoe: {
          resourceType: 'Questionnaire',
          status: 'active',
          url: 'https://labs-api.zapehr.com/v1/canonical-questionnaire/lab/790b282d-77e9-4697-9f59-0cef8238033a/compendium/IEwOD5aYRdOOdp_miWkefa04RuJAMJ_c/item/57021-8/questionnaire',
          item: [
            {
              linkId: 'fnGTTFtCXBLCunRi1MMF2Q',
              text: 'What is your name?',
              type: 'text',
              required: true,
              code: [
                {
                  system: '790b282d-77e9-4697-9f59-0cef8238033a-original-question-code',
                  code: 'Name',
                },
              ],
            },
            {
              linkId: '6szLG2rE8mLaOCCAUyZspw',
              text: 'Do you seek the Holy Grail?',
              type: 'boolean',
              required: true,
              code: [
                {
                  system: '790b282d-77e9-4697-9f59-0cef8238033a-original-question-code',
                  code: 'Quest',
                },
              ],
            },
            {
              linkId: 'o4HY4-cbrXEJD3pLZW64iA',
              text: 'What is your favorite color?',
              type: 'choice',
              required: true,
              code: [
                {
                  system: '790b282d-77e9-4697-9f59-0cef8238033a-original-question-code',
                  code: 'Color',
                },
              ],
              answerOption: [
                {
                  id: 'blue',
                  valueString: 'blue',
                },
                {
                  id: 'yellow',
                  valueString: 'yellow',
                },
                {
                  id: 'green',
                  valueString: 'green',
                },
              ],
            },
            {
              linkId: 'aj-4rVy3UIYDiUPPyyHZ-w',
              text: 'What is the air-speed velocity of an unladen sparrow?',
              type: 'decimal',
              required: false,
              code: [
                {
                  system: '790b282d-77e9-4697-9f59-0cef8238033a-original-question-code',
                  code: 'Sparrow',
                },
              ],
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/formatted-input-requirement',
                  valueString: '###.##',
                },
              ],
            },
            {
              linkId: '_BzD8O8wEbum9n16WnT4sg',
              text: 'What is the capital of Assyria?',
              type: 'choice',
              required: false,
              code: [
                {
                  system: '790b282d-77e9-4697-9f59-0cef8238033a-original-question-code',
                  code: 'Capitol',
                },
              ],
              answerOption: [
                {
                  id: 'Assur',
                  valueString: 'Assur',
                },
                {
                  id: 'Dur-Sharrukin',
                  valueString: 'Dur-Sharrukin',
                },
                {
                  id: 'Harran',
                  valueString: 'Harran',
                },
                {
                  id: 'Kar-Tukulti-Ninurta',
                  valueString: 'Kar-Tukulti-Ninurta',
                },
                {
                  id: 'Nimrud',
                  valueString: 'Nimrud',
                },
                {
                  id: 'Nineveh',
                  valueString: 'Nineveh',
                },
              ],
              extension: [
                {
                  url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type',
                  valueString: 'multi-select list',
                },
              ],
            },
          ],
        },
      },
    },
    searchTerm: 'CBC',
    aoeAnswers: {
      fnGTTFtCXBLCunRi1MMF2Q: { type: 'text', answer: 'monkey d luffy' },
      '6szLG2rE8mLaOCCAUyZspw': { type: 'boolean', answer: true },
      'o4HY4-cbrXEJD3pLZW64iA': { type: 'choice', answer: 'blue' },
      'aj-4rVy3UIYDiUPPyyHZ-w': { type: 'decimal', answer: 100 },
    },
  },
  noAoe: {
    labsData: {
      lab: {
        labGuid: '790b282d-77e9-4697-9f59-0cef8238033a',
        labName: 'AutoLab',
        labType: 'Laboratory',
        compendiumVersion: 'IEwOD5aYRdOOdp_miWkefa04RuJAMJ_c',
      },
      item: {
        itemCode: '30341-2',
        itemLoinc: '30341-2',
        itemType: 'Lab Test',
        itemName: 'Erythrocyte Sedimentation Rate',
        uniqueName: '30341-2_Erythrocyte Sedimentation Rate',
        specimens: [
          {
            container: 'serum separator tube',
            volume: '2 mL',
            minimumVolume: null,
            storageRequirements: 'Refrigerated',
            collectionInstructions: null,
          },
        ],
        components: [
          {
            componentItemCode: '30341-2',
            name: 'Erythrocyte sedimentation rate',
            loinc: '30341-2',
            uom: 'mm/hr',
            range: '<20 mm/hr',
            type: 'List',
          },
        ],
        cptCodes: [{ cptCode: '85652', serviceUnitsCount: null }],
        aoe: null,
      },
    },
    searchTerm: 'rate',
    aoeAnswers: {},
  },
};
