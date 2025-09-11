import { useQuery } from '@tanstack/react-query';
import { ExamType, ListTemplatesZambdaOutput } from 'utils';
import { listTemplates } from '../../api/api';
import { QUERY_STALE_TIME } from '../../constants';
import { useApiClients } from '../../hooks/useAppClients';

export interface TemplateOption {
  value: string;
  label: string;
}

export interface UseListTemplatesResult {
  templates: TemplateOption[];
  isLoading: boolean;
  error: Error | null;
}

export const useListTemplates = (examType: ExamType): UseListTemplatesResult => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery<ListTemplatesZambdaOutput, Error>({
    queryKey: ['list-templates', examType],
    queryFn: async () => {
      if (!oystehrZambda) {
        throw new Error('API client not available');
      }
      return await listTemplates(oystehrZambda, { examType });
    },
    enabled: !!oystehrZambda,
    staleTime: QUERY_STALE_TIME,
  });

  const templates: TemplateOption[] = queryResult.data
    ? queryResult.data.templates.map((template) => ({
        value: template,
        label: template,
      }))
    : [];

  return {
    templates,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
  };
};
