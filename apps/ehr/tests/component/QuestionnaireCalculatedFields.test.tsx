/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PaperworkProvider } from 'ui-components/lib/components/paperwork/context';
import PagedQuestionnaire from 'ui-components/lib/components/paperwork/PagedQuestionnaire';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from 'utils/lib/fhir/constants';
import {
  convertQuestionnaireItemToQRLinkIdMap,
  mapQuestionnaireAndValueSetsToItemsList,
} from 'utils/lib/helpers/paperwork/paperwork';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  updateVisitForm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(() => ({ oystehrZambda: {} })),
}));

import { updateVisitForm } from '../../src/api/api';
import { EditFormResponseDialog } from '../../src/components/dialogs/EditFormResponseDialog';
import { QuestionnaireResponseViewer } from '../../src/components/QuestionnaireResponseViewer';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { QuestionnairePreview } from '../../src/features/visits/telemed/components/admin/questionnaires/components/QuestionnairePreview';
import { QuestionnaireTestDialog } from '../../src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireTestDialog';
import {
  countPreviewPages,
  stubPaperworkContext,
} from '../../src/features/visits/telemed/components/admin/questionnaires/questionnaire-utils';

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

// the questionnaire as the admin tools receive it: raw FHIR, with a readOnly + disabled-display hidden results page
const cageQuestionnaire = (hideResults: boolean): Questionnaire => ({
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/cage',
  version: '1.0.0',
  status: 'active',
  title: 'CAGE',
  item: [
    { linkId: 'items', type: 'group', text: 'Items', item: [yesNo('q1', 'Cut down'), yesNo('q2', 'Annoyed')] },
    {
      linkId: 'results',
      type: 'group',
      text: 'Results',
      ...(hideResults && { readOnly: true }),
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
      ],
    },
  ],
});

describe('admin preview and test of a form with a hidden results page', () => {
  // the default select input for a choice loads its options through react-query
  const withProviders = (ui: ReactElement): ReactElement => (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

  const renderPreview = (questionnaire: Questionnaire): void => {
    render(
      withProviders(
        <QuestionnairePreview
          questionnaire={questionnaire}
          currentPageIndex={0}
          setCurrentPageIndex={vi.fn()}
          completed={false}
          setCompleted={vi.fn()}
          previewMode="ui-only"
        />
      )
    );
  };

  it('counts only the pages a patient is taken through', () => {
    expect(countPreviewPages(cageQuestionnaire(true))).toBe(1);
    expect(countPreviewPages(cageQuestionnaire(false))).toBe(2);
  });

  it('previews a single page when the results page is hidden', async () => {
    renderPreview(cageQuestionnaire(true));

    expect(await screen.findByText('Cut down')).toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it('still previews every page when no page is hidden', async () => {
    renderPreview(cageQuestionnaire(false));

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('tests a single page, so the one button submits the form', async () => {
    render(withProviders(<QuestionnaireTestDialog open onClose={vi.fn()} questionnaire={cageQuestionnaire(true)} />));

    expect(await screen.findByText('Cut down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });
});

// ---- recording calculated values ----

const answeredYes = (
  linkId: string
): { linkId: string; answer: { valueCoding: { code: string; display: string } }[] } => ({
  linkId,
  answer: [{ valueCoding: { code: '1', display: 'Yes' } }],
});
const answeredNo = (
  linkId: string
): { linkId: string; answer: { valueCoding: { code: string; display: string } }[] } => ({
  linkId,
  answer: [{ valueCoding: { code: '0', display: 'No' } }],
});

describe('QuestionnaireResponseViewer with recorded calculated values', () => {
  const formWithResults = (
    status: QuestionnaireResponse['status'],
    recordedTotal: string | undefined
  ): StandaloneFormDTO => {
    const form = hiddenResultsForm();
    form.questionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'qr-3',
      status,
      item: [
        { linkId: 'items', item: [answeredYes('q1'), answeredYes('q2')] },
        {
          linkId: 'results',
          item: recordedTotal === undefined ? [] : [{ linkId: 'total', answer: [{ valueString: recordedTotal }] }],
        },
      ],
    };
    return form;
  };

  it('shows the recorded value of a finished form, with no note when it agrees with the answers', () => {
    render(<QuestionnaireResponseViewer form={formWithResults('completed', '2')} />);

    expect(screen.getByText('Total:').parentElement).toHaveTextContent('Total: 2');
    expect(screen.queryByTestId('calculated-mismatch-total')).not.toBeInTheDocument();
  });

  it('shows the recorded value and points out that it no longer agrees with the answers', () => {
    render(<QuestionnaireResponseViewer form={formWithResults('amended', '5')} />);

    expect(screen.getByText('Total:').parentElement).toHaveTextContent('Total: 5');
    expect(screen.getByTestId('calculated-mismatch-total')).toHaveTextContent('recalculated: 2');
  });

  it('calculates a value that was never recorded', () => {
    render(<QuestionnaireResponseViewer form={formWithResults('completed', undefined)} />);

    expect(screen.getByText('Total:').parentElement).toHaveTextContent('Total: 2');
    expect(screen.queryByTestId('calculated-mismatch-total')).not.toBeInTheDocument();
  });

  it('does not trust a partial score recorded while the form is still being filled in', () => {
    render(<QuestionnaireResponseViewer form={formWithResults('in-progress', '1')} />);

    expect(screen.getByText('Total:').parentElement).toHaveTextContent('Total: 2');
    expect(screen.queryByTestId('calculated-mismatch-total')).not.toBeInTheDocument();
  });

  it('says Not Started when only calculated values are recorded', () => {
    const form = formWithResults('in-progress', '0');
    form.questionnaireResponse.item = [
      { linkId: 'items', item: [] },
      { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '0' }] }] },
    ];
    render(<QuestionnaireResponseViewer form={form} />);

    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });
});

describe('EditFormResponseDialog recording calculated values', () => {
  beforeEach(() => {
    vi.mocked(updateVisitForm).mockClear();
  });

  const renderDialog = (form: StandaloneFormDTO): void => {
    render(
      <MemoryRouter>
        <EditFormResponseDialog form={form} patientId="patient-1" onClose={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    );
  };

  const radioForm = (): StandaloneFormDTO => ({
    questionnaireId: 'cage',
    questionnaireTitle: 'CAGE',
    allItems: mapQuestionnaireAndValueSetsToItemsList(
      [
        {
          linkId: 'items',
          type: 'group',
          text: 'Items',
          item: [yesNo('q1', 'Cut down', 'Radio'), yesNo('q2', 'Annoyed', 'Radio')],
        },
        {
          linkId: 'results',
          type: 'group',
          text: 'Results',
          readOnly: true,
          extension: [{ url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay, valueString: 'hidden' }],
          item: [
            { linkId: 'total', type: 'string', text: 'Total', extension: calculated(TOTAL_EXPRESSION) },
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
      id: 'qr-4',
      status: 'completed',
      item: [
        { linkId: 'items', item: [answeredYes('q1'), answeredNo('q2')] },
        {
          linkId: 'results',
          item: [
            { linkId: 'total', answer: [{ valueString: '1' }] },
            { linkId: 'positive-screen', answer: [{ valueBoolean: false }] },
          ],
        },
      ],
    },
  });

  it('sends the values for the hidden results page, which the dialog never shows, with the edited answers', async () => {
    renderDialog(radioForm());

    const annoyed = (await screen.findByText('Annoyed')).closest('div') as HTMLElement;
    await userEvent.click(within(annoyed.parentElement as HTMLElement).getByText('Yes'));
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.editFormResponseSaveButton));

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    const sent = vi.mocked(updateVisitForm).mock.calls[0][1];
    expect(sent.calculatedAnswers).toEqual([
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '2' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
        ],
      },
    ]);
  });

  it('sends only the values that changed', async () => {
    const form = radioForm();
    form.questionnaireResponse.item = [
      { linkId: 'items', item: [answeredYes('q1'), answeredNo('q2')] },
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '1' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: false }] },
        ],
      },
    ];
    renderDialog(form);

    // flipping the first answer to No takes the total to 0: the screen stays negative, so only the total is sent
    const cutDown = (await screen.findByText('Cut down')).closest('div') as HTMLElement;
    await userEvent.click(within(cutDown.parentElement as HTMLElement).getByText('No'));
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.editFormResponseSaveButton));

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    expect(vi.mocked(updateVisitForm).mock.calls[0][1].calculatedAnswers).toEqual([
      { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '0' }] }] },
    ]);
  });
});

describe('PagedQuestionnaire handing the calculated values to its host', () => {
  const hostedForm = (): { questionnaire: Questionnaire } => ({
    questionnaire: {
      resourceType: 'Questionnaire',
      status: 'active',
      item: [
        {
          linkId: 'items',
          type: 'group',
          text: 'Items',
          item: [yesNo('q1', 'Cut down', 'Radio'), yesNo('q2', 'Annoyed', 'Radio')],
        },
        {
          linkId: 'results',
          type: 'group',
          text: 'Results',
          readOnly: true,
          extension: [{ url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay, valueString: 'hidden' }],
          item: [{ linkId: 'total', type: 'string', text: 'Total', extension: calculated(TOTAL_EXPRESSION) }],
        },
      ],
    },
  });

  it('computes the hidden results page when the visible page is saved, from the values just entered', async () => {
    const { questionnaire } = hostedForm();
    const allItems = mapQuestionnaireAndValueSetsToItemsList(structuredClone(questionnaire.item ?? []), []);
    const visiblePages = allItems.filter((item) => item.linkId === 'items');
    const response: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: [
        { linkId: 'items', item: [] },
        { linkId: 'results', item: [] },
      ],
    };
    const context = {
      ...stubPaperworkContext(visiblePages, allItems, response, vi.fn(), 'Continue'),
      // a host lists every page, hidden ones included, as the questionnaire's top-level items
      pageItems: allItems,
    };
    const onSubmit = vi.fn();
    const page = visiblePages[0];
    const defaultValues = {
      ...convertQuestionnaireItemToQRLinkIdMap(page?.item),
      q1: answeredYes('q1'),
      q2: answeredYes('q2'),
    };

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PaperworkProvider value={context}>
            <PagedQuestionnaire
              pageId="items"
              pageItem={page}
              items={page?.item ?? []}
              defaultValues={defaultValues}
              onSubmit={onSubmit}
              saveProgress={vi.fn()}
              skipValidation={false}
            />
          </PaperworkProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [data, extras] = onSubmit.mock.calls[0];
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['q1', 'q2']));
    expect(extras).toEqual({
      calculatedAnswers: [{ linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '2' }] }] }],
    });
  });
});
