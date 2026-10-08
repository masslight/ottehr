/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from 'utils/lib/fhir/constants';
import { mapQuestionnaireAndValueSetsToItemsList } from 'utils/lib/helpers/paperwork/paperwork';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  updateVisitForm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(() => ({ oystehrZambda: {} })),
}));

import { EditFormResponseDialog } from '../../src/components/dialogs/EditFormResponseDialog';
import { QuestionnaireResponseViewer } from '../../src/components/QuestionnaireResponseViewer';

const calculated = (expression: string): QuestionnaireItem['extension'] => [
  {
    url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression,
    valueExpression: { language: 'text/javascript', expression },
  },
];

const yesNo = (linkId: string, text: string, preferredElement?: string): QuestionnaireItem => ({
  linkId,
  type: 'choice',
  text,
  answerOption: [{ valueCoding: { code: '0', display: 'No' } }, { valueCoding: { code: '1', display: 'Yes' } }],
  ...(preferredElement && {
    extension: [{ url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.preferredElement, valueString: preferredElement }],
  }),
});

const TOTAL_EXPRESSION = '(answers["q1"]||0)+(answers["q2"]||0)';

// like CAGE, but the radio answers and a visible total share one page, so the total can be watched changing
const visibleTotalForm = (answered: boolean): StandaloneFormDTO => ({
  questionnaireId: 'scored',
  questionnaireTitle: 'Scored Form',
  allItems: mapQuestionnaireAndValueSetsToItemsList(
    [
      {
        linkId: 'page-one',
        type: 'group',
        text: 'Page one',
        item: [
          yesNo('q1', 'Cut down', 'Radio'),
          yesNo('q2', 'Annoyed', 'Radio'),
          { linkId: 'total', type: 'string', text: 'Total', extension: calculated(TOTAL_EXPRESSION) },
        ],
      },
    ],
    []
  ),
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-1',
    status: 'in-progress',
    item: [
      {
        linkId: 'page-one',
        item: answered
          ? [{ linkId: 'q1', answer: [{ valueCoding: { code: '1', display: 'Yes' } }] }]
          : [{ linkId: 'q1' }],
      },
    ],
  },
});

// a calculated results page that the patient never sees (readOnly + disabled-display hidden)
const hiddenResultsForm = (): StandaloneFormDTO => ({
  questionnaireId: 'cage',
  questionnaireTitle: 'CAGE',
  allItems: mapQuestionnaireAndValueSetsToItemsList(
    [
      { linkId: 'items', type: 'group', text: 'Items', item: [yesNo('q1', 'Cut down'), yesNo('q2', 'Annoyed')] },
      {
        linkId: 'results',
        type: 'group',
        text: 'Results',
        readOnly: true,
        extension: [{ url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay, valueString: 'hidden' }],
        item: [
          {
            linkId: 'total',
            type: 'string',
            text: 'Total',
            extension: [
              { url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay, valueString: 'hidden' },
              ...(calculated(TOTAL_EXPRESSION) ?? []),
            ],
          },
          {
            linkId: 'positive-screen',
            type: 'boolean',
            text: 'Positive screen',
            extension: calculated('(answers["total"]||0) >= 2'),
          },
        ],
      },
    ],
    []
  ),
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-2',
    status: 'completed',
    item: [
      {
        linkId: 'items',
        item: [
          { linkId: 'q1', answer: [{ valueCoding: { code: '1', display: 'Yes' } }] },
          { linkId: 'q2', answer: [{ valueCoding: { code: '1', display: 'Yes' } }] },
        ],
      },
    ],
  } satisfies QuestionnaireResponse,
});

describe('coded choices and calculated fields in the paperwork form', () => {
  it('shows the display of a coded choice, and a calculated field follows the answers as they change', async () => {
    render(
      <MemoryRouter>
        <EditFormResponseDialog
          form={visibleTotalForm(true)}
          patientId="patient-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    );

    // options read No / Yes, never the codes 0 / 1
    expect(await screen.findAllByText('Yes')).toHaveLength(2);
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    const total = screen.getByTestId('calculated-total');
    expect(total).toHaveTextContent('1');

    // answering the second question moves the total without saving anything
    const annoyed = screen.getByText('Annoyed').closest('div') as HTMLElement;
    await userEvent.click(within(annoyed.parentElement as HTMLElement).getByText('Yes'));
    await waitFor(() => expect(screen.getByTestId('calculated-total')).toHaveTextContent('2'));
  });

  it('calculates from whatever is answered so far, treating unanswered coded choices as absent', async () => {
    render(
      <MemoryRouter>
        <EditFormResponseDialog
          form={visibleTotalForm(false)}
          patientId="patient-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    );

    // an unanswered coded choice leaves both addends out, so the sum is 0
    expect(await screen.findByTestId('calculated-total')).toHaveTextContent('0');
  });
});

describe('QuestionnaireResponseViewer', () => {
  it('shows calculated results that the patient form hides, worked out from the recorded answers', () => {
    render(<QuestionnaireResponseViewer form={hiddenResultsForm()} />);

    expect(screen.getByText('Cut down:').parentElement).toHaveTextContent('Cut down: Yes');
    expect(screen.getByText('Total:').parentElement).toHaveTextContent('Total: 2');
    expect(screen.getByText('Positive screen:').parentElement).toHaveTextContent('Positive screen: Yes');
  });

  it('still says Not Started when nothing has been answered', () => {
    const form = hiddenResultsForm();
    form.questionnaireResponse.item = [];
    render(<QuestionnaireResponseViewer form={form} />);

    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });
});
