import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { createTemplate, deleteTemplate, listAllTemplates, renameTemplate } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AdminListTemplateItem,
  CreateTemplateInput,
  CreateTemplateOutput,
  DeleteTemplateInput,
  RenameTemplateInput,
} from 'utils';

const LIST_ALL_TEMPLATES_QUERY_KEY = ['list-all-templates'];

export const useListAllTemplatesQuery = (): UseQueryResult<AdminListTemplateItem[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: LIST_ALL_TEMPLATES_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      const result = await listAllTemplates(oystehrZambda, {});
      return result.templates;
    },
    enabled: !!oystehrZambda,
  });
};

export const useRenameTemplateMutation = (): UseMutationResult<void, Error, RenameTemplateInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RenameTemplateInput) => {
      if (!oystehrZambda) throw new Error('API client not available');
      await renameTemplate(oystehrZambda, params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_ALL_TEMPLATES_QUERY_KEY });
    },
  });
};

export const useDeleteTemplateMutation = (): UseMutationResult<void, Error, DeleteTemplateInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteTemplateInput) => {
      if (!oystehrZambda) throw new Error('API client not available');
      await deleteTemplate(oystehrZambda, params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_ALL_TEMPLATES_QUERY_KEY });
    },
  });
};

export const useCreateTemplateMutation = (): UseMutationResult<CreateTemplateOutput, Error, CreateTemplateInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateTemplateInput) => {
      if (!oystehrZambda) throw new Error('API client not available');
      return await createTemplate(oystehrZambda, params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_ALL_TEMPLATES_QUERY_KEY });
    },
  });
};
