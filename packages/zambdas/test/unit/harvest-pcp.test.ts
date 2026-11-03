import { Patient, Practitioner, Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { createMasterRecordPatchOperations, getPCPPatchOps } from '../../src/ehr/shared/harvest';

const patientWithPcp = (): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  generalPractitioner: [{ reference: '#primary-care-physician', type: 'Practitioner' }],
  contained: [
    {
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      name: [{ family: 'Green', given: ['Olivia'] }],
      telecom: [
        { system: 'phone', value: '+12125559999' },
        { system: 'fax', value: '+12125551234' },
      ],
      address: [{ text: '1 Main St, New York, NY' }],
      active: true,
    },
  ],
});

const answered = (linkId: string, value?: string): QuestionnaireResponseItem =>
  value ? { linkId, answer: [{ valueString: value }] } : { linkId };

const intakeFormLinkIds = ['pcp-first', 'pcp-last', 'pcp-practice', 'pcp-address', 'pcp-number'];

const containedFromOps = (ops: ReturnType<typeof getPCPPatchOps>): Practitioner => {
  const op = ops.find((entry) => entry.path === '/contained');
  if (!op || !('value' in op)) throw new Error('expected a /contained patch op');
  return (op.value as Practitioner[])[0];
};

describe('getPCPPatchOps', () => {
  it('keeps the stored fax when the form has no fax field (intake paperwork)', () => {
    const intakeItems = [
      answered('pcp-first', 'Olivia'),
      answered('pcp-last', 'Green'),
      answered('pcp-practice'),
      answered('pcp-address', '1 Main St, New York, NY'),
      answered('pcp-number', '(212) 555-0000'),
    ];

    const updated = containedFromOps(getPCPPatchOps(intakeItems, patientWithPcp(), intakeFormLinkIds));

    expect(updated.telecom).toEqual([
      { system: 'phone', value: '+12125550000' },
      { system: 'fax', value: '+12125551234' },
    ]);
  });

  it('clears the fax when the form sends the fax field unanswered (EHR patient record)', () => {
    const ehrItems = [
      { linkId: 'pcp-active', answer: [{ valueBoolean: true }] },
      answered('pcp-first', 'Olivia'),
      answered('pcp-last', 'Green'),
      answered('pcp-practice', 'Green Family Practice'),
      answered('pcp-address', '1 Main St, New York, NY'),
      answered('pcp-number', '(212) 555-9999'),
      answered('pcp-fax'),
    ];

    const updated = containedFromOps(
      getPCPPatchOps(ehrItems, patientWithPcp(), [...intakeFormLinkIds, 'pcp-fax', 'pcp-active'])
    );

    expect(updated.telecom).toEqual([{ system: 'phone', value: '+12125559999' }]);
  });
});

describe('createMasterRecordPatchOperations PCP page', () => {
  const intakeQuestionnaire: Questionnaire = {
    resourceType: 'Questionnaire',
    status: 'active',
    item: [
      {
        linkId: 'primary-care-physician-page',
        type: 'group',
        item: intakeFormLinkIds.map((linkId) => ({
          linkId,
          type: 'string' as const,
        })),
      },
    ],
  };

  it('clears a field the patient emptied (dropped from the response) but keeps the fax intake lacks', () => {
    const ops = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: [
          {
            linkId: 'primary-care-physician-page',
            item: [answered('pcp-first', 'Olivia'), answered('pcp-last', 'Green'), answered('pcp-address', '2 Elm St')],
          },
        ],
        sourceQuestionnaire: intakeQuestionnaire,
      },
      patientWithPcp()
    ).patient.patchOpsForDirectUpdate;

    const updated = containedFromOps(ops);

    expect(updated.address).toEqual([{ text: '2 Elm St' }]);
    expect(updated.telecom).toEqual([{ system: 'fax', value: '+12125551234' }]);
  });
});
