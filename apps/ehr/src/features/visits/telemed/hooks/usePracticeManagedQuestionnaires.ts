import { useQuery } from '@tanstack/react-query';
import { practiceManagedQuestionnaireList } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { PracticeManagedQuestionnaireDTO } from 'utils';

// Deleted questionnaires are soft-deleted (status: 'retired') so existing patient responses stay viewable
const isRetiredQuestionnaire = (q: PracticeManagedQuestionnaireDTO): boolean => q.status === 'retired';

interface UsePracticeManagedQuestionnairesResult {
  active: PracticeManagedQuestionnaireDTO[];
  deleted: PracticeManagedQuestionnaireDTO[];
  isLoading: boolean;
  error: Error | null;
}

export const usePracticeManagedQuestionnaires = (): UsePracticeManagedQuestionnairesResult => {
  const { oystehrZambda } = useApiClients();

  const { data, isLoading, error } = useQuery({
    queryKey: ['practice-managed-questionnaire-list'],
    queryFn: async () => {
      return practiceManagedQuestionnaireList(oystehrZambda!);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec
  });

  const sorted = (data?.practiceManagedQuestionnaires || [])
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  return {
    active: sorted.filter((q) => !isRetiredQuestionnaire(q)),
    deleted: sorted.filter(isRetiredQuestionnaire),
    isLoading,
    error,
  };
};
