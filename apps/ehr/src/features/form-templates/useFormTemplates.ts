import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { ListFormTemplatesOutput } from 'utils/lib/types/api/form-template.types';
import { listFormTemplates } from './form-templates.api';

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
