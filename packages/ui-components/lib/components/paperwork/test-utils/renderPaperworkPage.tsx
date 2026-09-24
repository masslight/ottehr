import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderResult } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { convertQRItemToLinkIdMap, convertQuestionnaireItemToQRLinkIdMap } from 'utils/lib/helpers/paperwork/paperwork';
import { QuestionnaireFormFields } from 'utils/lib/types/data/paperwork/paperwork.types';
import { Mock, vi } from 'vitest';
import { PaperworkComponentHelpers, PaperworkContext, PaperworkProvider } from '../context';
import PagedQuestionnaire from '../PagedQuestionnaire';
import { stubPaperworkContext, stubPaperworkResponseForPreview } from '../previewStubs';

export interface RenderPaperworkPageOptions {
  /** linkId of the page to render. Defaults to the first page. */
  pageId?: string;
  /**
   * Answers keyed by the linkId of a page's top-level item. Each is saved on the page that holds
   * the item, so it prefills that page and conditions on every page see it.
   */
  values?: QuestionnaireFormFields;
  /** Helpers for specialized inputs (place search, uploads, answer options, ...). */
  helpers?: Partial<PaperworkComponentHelpers>;
  /** Run the page's validation schema on submit. Defaults to true. */
  validate?: boolean;
  /** Client for inputs that load options with react-query. Defaults to a new client without retries. */
  queryClient?: QueryClient;
}

export interface RenderPaperworkPageResult extends RenderResult {
  /** Receives the page's answers when the page submits. */
  onSubmit: Mock<(data: QuestionnaireFormFields) => void>;
  /** The PaperworkContext the page renders with. */
  context: PaperworkContext;
  user: UserEvent;
}

/**
 * Render one page of a questionnaire through the real paperwork renderer, the way the EHR
 * questionnaire preview does: stub paperwork state in a PaperworkProvider around
 * PagedQuestionnaire. The page renders inside a router (ControlButtons navigates) and a
 * QueryClientProvider (inputs with dynamic answer options query).
 */
export function renderPaperworkPage(
  questionnaire: Questionnaire,
  options: RenderPaperworkPageOptions = {}
): RenderPaperworkPageResult {
  const { pageId, values = {}, helpers, validate = true } = options;
  const queryClient = options.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const { allItems, questionnaireResponse, questionnaireTitle } = stubPaperworkResponseForPreview(questionnaire);
  const pages = allItems.filter((item) => item.linkId);
  const page = pageId ? pages.find((candidate) => candidate.linkId === pageId) : pages[0];
  if (!page) {
    throw new Error(`Questionnaire has no page ${pageId ? `"${pageId}"` : 'to render'}`);
  }

  const pageLinkIdByItem = new Map(
    pages.flatMap((candidate) => (candidate.item ?? []).map((item) => [item.linkId, candidate.linkId] as const))
  );
  const unplaced = Object.keys(values).filter((linkId) => !pageLinkIdByItem.has(linkId));
  if (unplaced.length > 0) {
    throw new Error(`values reference no top-level page item: ${unplaced.join(', ')}`);
  }
  const answeredResponse: QuestionnaireResponse = {
    ...questionnaireResponse,
    item: questionnaireResponse.item?.map((pageResponse) => ({
      ...pageResponse,
      item: Object.entries(values)
        .filter(([linkId]) => pageLinkIdByItem.get(linkId) === pageResponse.linkId)
        .map(([, answer]) => answer),
    })),
  };

  const context = stubPaperworkContext({
    pages,
    allItems,
    questionnaireResponse: answeredResponse,
    continueLabel: 'Continue',
    paperworkComponentHelpers: helpers,
  });

  // Same page defaults as the intake paperwork page and the EHR preview
  const pageAnswers = answeredResponse.item?.find((pageResponse) => pageResponse.linkId === page.linkId)?.item;
  const defaultValues = {
    ...convertQuestionnaireItemToQRLinkIdMap(page.item),
    ...convertQRItemToLinkIdMap(pageAnswers),
  };

  const onSubmit = vi.fn<(data: QuestionnaireFormFields) => void>();
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PaperworkProvider value={context}>
          <PagedQuestionnaire
            onSubmit={onSubmit}
            pageId={page.linkId}
            pageItem={page}
            pageSubtitle={questionnaireTitle}
            options={{ controlButtons: { backButton: false } }}
            items={page.item ?? []}
            defaultValues={defaultValues}
            saveProgress={() => {}}
            skipValidation={!validate}
          />
        </PaperworkProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );

  return { ...result, onSubmit, context, user };
}
