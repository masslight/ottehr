import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  FillFormTemplateInput,
  FillFormTemplateOutput,
  ListFormTemplatesOutput,
} from 'utils/lib/types/api/form-template.types';
import { fillFormTemplate, listFormTemplates } from './form-templates.api';

export const FORM_TEMPLATES_QUERY_KEY = 'form-templates';

/**
 * Form templates for the current project.
 *
 * `includeUnpublished` separates the two callers: the admin page passes `true` so drafts are editable,
 * while the patient chart leaves it off and only ever sees published templates. The two are cached
 * separately because they are genuinely different result sets.
 */
export const useFormTemplates = (options?: {
  includeUnpublished?: boolean;
}): UseQueryResult<ListFormTemplatesOutput> => {
  const { oystehrZambda } = useApiClients();
  const includeUnpublished = options?.includeUnpublished ?? false;

  return useQuery({
    queryKey: [FORM_TEMPLATES_QUERY_KEY, { includeUnpublished }],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      return listFormTemplates(oystehrZambda, { includeUnpublished });
    },
    enabled: !!oystehrZambda,
  });
};

/**
 * Prefills a template for one visit.
 *
 * A mutation rather than a query because each call has an effect: it stores a copy against the patient and
 * retires the previous one. Nothing is cached — asking twice is meant to produce a fresh document, since
 * the chart may have moved on since the last one.
 */
export const useFillFormTemplate = (): UseMutationResult<FillFormTemplateOutput, Error, FillFormTemplateInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationFn: async (input: FillFormTemplateInput) => {
      if (!oystehrZambda) throw new Error('API client not available');
      return fillFormTemplate(oystehrZambda, input);
    },
  });
};
