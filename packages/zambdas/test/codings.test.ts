import { Coding } from 'fhir/r4b';
import { codingsEqual } from 'utils';
import { expect, vi } from 'vitest';
export const DEFAULT_TEST_TIMEOUT = 100000;
export const location = '71bc5925-65d6-471f-abd0-be357043172a';

const contactArray = [
  {
    telecom: [
      {
        value: 'ykulik+up1@masslight.com',
        system: 'email',
      },
      {
        value: '1212121212',
        system: 'phone',
      },
    ],
    relationship: [
      {
        coding: [
          {
            code: 'Parent/Guardian',
            system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
            display: 'Parent/Guardian',
          },
        ],
      },
    ],
  },
  {
    name: {
      use: 'usual',
      given: ['Yevheniia'],
      family: 'Yevheniia',
    },
    telecom: [
      {
        use: 'mobile',
        rank: 1,
        value: '5555555555',
        system: 'phone',
      },
    ],
    relationship: [
      {
        coding: [
          {
            code: 'BP',
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            display: 'Billing contact person',
          },
        ],
      },
    ],
  },
];

describe('appointments tests', () => {
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  test('Codings equal = true when codings equal', async () => {
    const coding1 = {
      code: 'BP',
      system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
      display: 'Billing contact person',
    };

    const indexOfCurrent = contactArray.findIndex((contactEntry) => {
      return contactEntry.relationship?.some((relationship) => {
        const coding = (relationship.coding ?? []) as Coding[];
        console.log('coding', coding);
        return codingsEqual((coding[0] ?? {}) as Coding, coding1);
      });
    });

    const currentBillingContact = contactArray[indexOfCurrent];
    expect(indexOfCurrent).toBe(1);
    expect(currentBillingContact).toBeDefined();
  });
});
