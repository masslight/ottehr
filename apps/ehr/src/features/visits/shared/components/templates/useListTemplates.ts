import { useQuery } from '@tanstack/react-query';
import { listTemplates } from 'src/api/api';
import { QUERY_STALE_TIME } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import { ExamType, ListTemplatesZambdaOutput } from 'utils';

export interface TemplateOption {
  value: string;
  label: string;
  id: string;
  isCurrentVersion: boolean;
}

export interface UseListTemplatesResult {
  templates: TemplateOption[];
  isLoading: boolean;
  error: Error | null;
}

export const useListTemplates = (examType: ExamType, options?: { enabled?: boolean }): UseListTemplatesResult => {
  const { oystehrZambda } = useApiClients();
  const enabled = (options?.enabled ?? true) && !!oystehrZambda;

  const queryResult = useQuery<ListTemplatesZambdaOutput, Error>({
    queryKey: ['list-templates', examType],
    queryFn: async () => {
      if (!oystehrZambda) {
        throw new Error('API client not available');
      }
      return await listTemplates(oystehrZambda, { examType, includeVersionData: true });
    },
    enabled,
    staleTime: QUERY_STALE_TIME,
  });

  const templates: TemplateOption[] = queryResult.data
    ? queryResult.data.templates
        .filter((template) => !!template.title)
        .map((template) => ({
          value: template.title,
          label: template.title,
          id: template.id,
          isCurrentVersion: template.versionData?.isCurrentVersion ?? true,
        }))
    : [];

  return {
    templates,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
  };
};
