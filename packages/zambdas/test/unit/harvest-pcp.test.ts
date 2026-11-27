import { Patient, Practitioner, Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { mapQuestionnaireAndValueSetsToItemsList } from 'utils/lib/helpers/paperwork/paperwork';
import { recursiveGroupTransform } from 'utils/lib/helpers/paperwork/validation';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE } from 'utils/lib/ottehr-config/intake-paperwork';
import { PATIENT_RECORD_QUESTIONNAIRE } from 'utils/lib/ottehr-config/patient-record';
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

const NO_PCP_CONFIRMED: Practitioner = { resourceType: 'Practitioner', id: 'primary-care-physician', active: false };

const patientWithNoPcpConfirmed = (): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  generalPractitioner: [{ reference: '#primary-care-physician', type: 'Practitioner' }],
  contained: [{ ...NO_PCP_CONFIRMED }],
});

const patientWithUnknownPcp = (): Patient => ({ resourceType: 'Patient', id: 'patient-1' });

const pcpActive = (value?: boolean): QuestionnaireResponseItem =>
  value === undefined ? { linkId: 'pcp-active' } : { linkId: 'pcp-active', answer: [{ valueBoolean: value }] };

const EHR_PCP_DETAIL_LINK_IDS = ['pcp-practice', 'pcp-first', 'pcp-last', 'pcp-address', 'pcp-number', 'pcp-fax'];

const untouchedEmptyEhrPcpFields = EHR_PCP_DETAIL_LINK_IDS.map((linkId) => answered(linkId));

const clearedEhrPcpFields = EHR_PCP_DETAIL_LINK_IDS.map((linkId) => ({ linkId, answer: [] }));

const removesPcp = [
  { op: 'remove', path: '/generalPractitioner' },
  { op: 'remove', path: '/contained' },
];

describe('getPCPPatchOps PCP states', () => {
  it('confirms no PCP as an inactive Practitioner without the previous details', () => {
    expect(getPCPPatchOps([pcpActive(false)], patientWithPcp())).toEqual([
      { op: 'replace', path: '/contained', value: [NO_PCP_CONFIRMED] },
    ]);
  });

  it('confirms no PCP for a patient with nothing on file', () => {
    expect(getPCPPatchOps([pcpActive(false)], patientWithUnknownPcp())).toEqual([
      { op: 'add', path: '/contained', value: [NO_PCP_CONFIRMED] },
      {
        op: 'add',
        path: '/generalPractitioner',
        value: [{ reference: '#primary-care-physician', resourceType: 'Practitioner' }],
      },
    ]);
  });

  it.each([
    ['confirmed again', pcpActive(false)],
    ['still ticked but unchanged (bare item)', pcpActive()],
  ])('keeps a confirmed no-PCP when the box is %s', (_label, item) => {
    expect(getPCPPatchOps([item], patientWithNoPcpConfirmed())).toEqual([]);
  });

  it('returns a confirmed no-PCP to unknown when the box is unticked with no details', () => {
    expect(getPCPPatchOps([pcpActive(true), ...untouchedEmptyEhrPcpFields], patientWithNoPcpConfirmed())).toEqual(
      removesPcp
    );
  });

  it('returns an active PCP to unknown when staff clear every detail', () => {
    expect(getPCPPatchOps([pcpActive(true), ...clearedEhrPcpFields], patientWithPcp())).toEqual(removesPcp);
  });

  it('leaves an active PCP alone when an untouched, empty PCP section is saved (stale unknown form)', () => {
    expect(getPCPPatchOps([pcpActive(true), ...untouchedEmptyEhrPcpFields], patientWithPcp())).toEqual([]);
  });

  it('leaves unknown alone when the box stays unticked and the details stay empty', () => {
    expect(getPCPPatchOps([pcpActive(true), ...untouchedEmptyEhrPcpFields], patientWithUnknownPcp())).toEqual([]);
  });

  it.each([
    ['first name', 'pcp-first', { given: ['Sam'] }],
    ['last name', 'pcp-last', { family: 'Sam' }],
  ])('records a PCP when staff enter only a %s', (_label, linkId, expectedName) => {
    const details = untouchedEmptyEhrPcpFields.map((item) => (item.linkId === linkId ? answered(linkId, 'Sam') : item));

    expect(containedFromOps(getPCPPatchOps([pcpActive(true), ...details], patientWithUnknownPcp()))).toEqual({
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      name: [expectedName],
      active: true,
    });
  });

  it('leaves a PCP stored without an active flag alone when the box arrives unticked with no details', () => {
    const patient = patientWithPcp();
    delete (patient.contained?.[0] as Practitioner).active;

    expect(getPCPPatchOps([pcpActive(true), ...untouchedEmptyEhrPcpFields], patient)).toEqual([]);
  });

  it.each([
    ['a confirmed no-PCP', patientWithNoPcpConfirmed],
    ['an active PCP', patientWithPcp],
  ])('leaves %s alone when Save All sends only other sections', (_label, patient) => {
    const ops = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: [
          {
            linkId: 'patient-contact-info-section',
            item: [{ linkId: 'patient-email', answer: [{ valueString: 'new@example.com' }] }],
          },
        ],
        sourceQuestionnaire: PATIENT_RECORD_QUESTIONNAIRE(),
        options: { filterByEnableWhen: true },
      },
      patient()
    ).patient.patchOpsForDirectUpdate;

    expect(ops.filter((op) => op.path === '/contained' || op.path === '/generalPractitioner')).toEqual([]);
  });

  it('keeps an active PCP when staff clear every detail except the first name', () => {
    const details = clearedEhrPcpFields.map((item) =>
      item.linkId === 'pcp-first' ? answered('pcp-first', 'Olivia') : item
    );

    expect(containedFromOps(getPCPPatchOps([pcpActive(true), ...details], patientWithPcp()))).toMatchObject({
      name: [{ given: ['Olivia'] }],
      active: true,
    });
  });
});

describe('patient paperwork "I do not have a Primary Care Physician"', () => {
  const questionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
  const pageLinkId = 'primary-care-physician-page';
  const pageItems = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []).find(
    (page) => page.linkId === pageLinkId
  )?.item;
  if (!pageItems) throw new Error(`expected the ${pageLinkId} page in the intake paperwork`);

  const harvestPage = (submitted: QuestionnaireResponseItem[], patient: Patient): ReturnType<typeof getPCPPatchOps> =>
    createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: [{ linkId: pageLinkId, item: recursiveGroupTransform(pageItems, submitted) }],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true, includeSections: [pageLinkId] },
      },
      patient
    ).patient.patchOpsForDirectUpdate.filter((op) => op.path === '/contained' || op.path === '/generalPractitioner');

  const noPcp = (value: boolean): QuestionnaireResponseItem => ({
    linkId: 'pcp-none',
    answer: [{ valueBoolean: value }],
  });

  const prefilledPcp = [
    answered('pcp-first', 'Olivia'),
    answered('pcp-last', 'Green'),
    answered('pcp-address', '1 Main St, New York, NY'),
    answered('pcp-number', '(212) 555-9999'),
  ];

  it('confirms no PCP and drops the filled-in details and the stored fax', () => {
    expect(harvestPage([noPcp(true), ...prefilledPcp], patientWithPcp())).toEqual([
      { op: 'replace', path: '/contained', value: [NO_PCP_CONFIRMED] },
    ]);
  });

  it.each([
    ['a confirmed no-PCP', patientWithNoPcpConfirmed],
    ['unknown PCP information', patientWithUnknownPcp],
  ])('leaves %s alone when the page is skipped', (_label, patient) => {
    expect(harvestPage([], patient())).toEqual([]);
  });

  it('keeps a confirmed no-PCP when the patient comes back, unticks the box and leaves the details empty', () => {
    expect(harvestPage([noPcp(false)], patientWithNoPcpConfirmed())).toEqual([]);
  });

  it('keeps an active PCP when the box is ticked and unticked before continuing', () => {
    const updated = containedFromOps(harvestPage([noPcp(false), ...prefilledPcp], patientWithPcp()));

    expect(updated).toMatchObject({ active: true, name: [{ family: 'Green', given: ['Olivia'] }] });
  });
});
