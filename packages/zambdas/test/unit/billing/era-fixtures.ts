import { ClaimResponse, ClaimResponseItemAdjudication } from 'fhir/r4b';
import { OYSTEHR_ADJUDICATION_SYSTEM, X12_ADJUSTMENT_GROUP_SYSTEM } from '../../../src/billing/claim-amounts';
import { ERA_ITEM_PROCEDURE_CODE_EXTENSION, ERA_ITEM_UNITS_EXTENSION } from '../../../src/billing/shared';

export const adjudication = (
  code: string,
  amount: number,
  system = OYSTEHR_ADJUDICATION_SYSTEM
): ClaimResponseItemAdjudication => ({
  category: {
    coding: [
      {
        system,
        code,
      },
    ],
  },
  amount: {
    value: amount,
    currency: 'USD',
  },
});

export const casAdjustment = (group: string, amount: number, reasonCode?: string): ClaimResponseItemAdjudication => ({
  ...adjudication(group, amount, X12_ADJUSTMENT_GROUP_SYSTEM),
  ...(reasonCode
    ? {
        reason: {
          coding: [
            {
              system: 'https://x12.org/codes/claim-adjustment-reason-codes',
              code: reasonCode,
            },
          ],
        },
      }
    : {}),
});

export const eraItem = (parts: {
  sequence: number;
  procedureCode?: string;
  units?: number;
  adjudication: ClaimResponseItemAdjudication[];
}): NonNullable<ClaimResponse['item']>[number] => ({
  itemSequence: parts.sequence,
  adjudication: parts.adjudication,
  extension: [
    ...(parts.procedureCode
      ? [
          {
            url: ERA_ITEM_PROCEDURE_CODE_EXTENSION,
            valueString: parts.procedureCode,
          },
        ]
      : []),
    ...(parts.units !== undefined
      ? [
          {
            url: ERA_ITEM_UNITS_EXTENSION,
            valueQuantity: {
              value: parts.units,
            },
          },
        ]
      : []),
  ],
});

export const claimResponse = (overrides: Partial<ClaimResponse> = {}): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id: 'cr-1',
  status: 'active',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  patient: {
    reference: 'Patient/p1',
  },
  created: '2026-07-15',
  insurer: {
    display: 'Test Payer',
  },
  outcome: 'complete',
  request: {
    reference: 'Claim/c1',
  },
  ...overrides,
});
