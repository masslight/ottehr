import { PatientFormResponses } from 'src/features/visits/shared/components/patient-forms/PatientFormResponses';
import { defineStory } from '../../harness/story';
import { APPOINTMENT_ID, ENCOUNTER_ID, visitMocks, visitRoute } from './_fixtures';

const response = {
  questionnaireId: 'questionnaire-phq2',
  questionnaireTitle: 'PHQ-2 Depression Screening',
  questionnaireUrl: 'https://example.com/FHIR/Questionnaire/phq-2',
  placement: 'screening',
  encounterId: ENCOUNTER_ID,
  appointmentId: APPOINTMENT_ID,
  visitDate: '2026-11-13T15:00:00.000Z',
  visitTimezone: 'America/New_York',
  deletable: true,
  allItems: [
    {
      linkId: 'page-one',
      type: 'group',
      acceptsMultipleAnswers: false,
      alwaysFilter: false,
      item: [
        {
          linkId: 'q1',
          type: 'string',
          text: 'Little interest or pleasure in doing things',
          acceptsMultipleAnswers: false,
          alwaysFilter: false,
        },
        {
          linkId: 'q2',
          type: 'string',
          text: 'Feeling down, depressed, or hopeless',
          acceptsMultipleAnswers: false,
          alwaysFilter: false,
        },
      ],
    },
  ],
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-phq2',
    status: 'completed',
    item: [
      {
        linkId: 'page-one',
        item: [
          { linkId: 'q1', answer: [{ valueString: 'Not at all' }] },
          { linkId: 'q2', answer: [{ valueString: 'Several days' }] },
        ],
      },
    ],
  },
};

export default defineStory({
  title: 'Delete form?',
  source: 'apps/ehr/src/features/visits/shared/components/patient-forms/PatientFormResponses.tsx',
  base: 'DeleteDialog',
  kind: 'destructive-confirm',
  where: 'Visit chart → Screening / Questionnaires → ⋮ menu on a form card → Delete',
  ...visitRoute,
  mocks: [
    ...visitMocks(),
    { url: 'get-patient-form-responses', response: { status: 200, output: { responses: [response] } } },
  ],
  render: () => <PatientFormResponses placement="screening" scope="this-visit" />,
  play: async ({ user, screen, waitFor }) => {
    await user.click(
      await waitFor(() => screen.getByRole('button', { name: /Actions for PHQ-2/ }), { timeout: 10000 })
    );
    await user.click(await waitFor(() => screen.getByRole('menuitem', { name: /Delete/ })));
  },
  notes:
    'One mocked screening form response. The same component also opens EditFormResponseDialog and SendFormDialog, which live in src/components/dialogs and are covered there.',
});
