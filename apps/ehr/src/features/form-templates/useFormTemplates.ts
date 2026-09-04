import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { DocumentReference } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import { QUERY_KEYS as PATIENT_DOCS_QUERY_KEYS } from 'src/hooks/useGetPatientDocs';
import { FORM_INSTANCE_CATEGORY_SEARCH_PARAM } from 'utils/lib/fhir/constants';
import {
  FillFormTemplateInput,
  FillFormTemplateOutput,
  ListFormTemplatesOutput,
  SaveCompletedFormOutput,
} from 'utils/lib/types/api/form-template.types';
import { fileReturnedForm, fillFormTemplate, listFormTemplates, returnCompletedForm } from './form-templates.api';

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

/**
 * Files a completed form back onto the chart.
 *
 * On success the patient's documents are refetched, because the form has just become one of them and the
 * documents explorer is very likely the next place the provider looks.
 */
type ReturnInput =
  | { appointmentId: string; file: File }
  | { appointmentId: string; z3Url: string; templateId?: string; discard?: boolean };

/**
 * Files a completed form back onto the chart.
 *
 * Takes either a file to upload, or the location of one already uploaded — the second form completes an
 * upload that came back needing to be told what it is.
 */
/** The stored location rides along on the first leg, so a `needsSource` reply can be answered. */
type ReturnResult = SaveCompletedFormOutput & { z3Url?: string };

export const useReturnCompletedForm = (): UseMutationResult<ReturnResult, Error, ReturnInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReturnInput) => {
      if (!oystehrZambda) throw new Error('API client not available');
      if ('file' in input) {
        const { result, z3Url } = await returnCompletedForm(oystehrZambda, input);
        return { ...result, z3Url };
      }
      return fileReturnedForm(oystehrZambda, input);
    },
    onSuccess: (result) => {
      // Nothing was written for a refusal, a discard, or an upload still waiting to be identified.
      if (result.status !== 'verified' && result.status !== 'unstamped') return;
      void queryClient.invalidateQueries({ queryKey: [PATIENT_DOCS_QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS] });
      void queryClient.invalidateQueries({ queryKey: [PATIENT_DOCS_QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS] });
      void queryClient.invalidateQueries({ queryKey: [COMPLETED_FORMS_QUERY_KEY] });
    },
  });
};

export const COMPLETED_FORMS_QUERY_KEY = 'completed-forms';

/**
 * Template ids that already have a completed form filed against this visit.
 *
 * Drives a "saved to the chart" marker on each form. There is deliberately no counterpart warning for
 * forms that have not come back: a form generated an hour ago and still being filled in is the ordinary
 * case, and flagging it would cry wolf on every visit. The marker's absence carries the same information
 * without asserting that anything is wrong.
 */
export const useCompletedForms = (patientId?: string, encounterId?: string): UseQueryResult<Set<string>> => {
  const { oystehr } = useApiClients();

  return useQuery({
    queryKey: [COMPLETED_FORMS_QUERY_KEY, { patientId, encounterId }],
    enabled: !!oystehr && !!patientId && !!encounterId,
    queryFn: async () => {
      if (!oystehr) throw new Error('API client not available');

      const docRefs = (
        await oystehr.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [
            { name: 'subject', value: `Patient/${patientId}` },
            { name: 'encounter', value: `Encounter/${encounterId}` },
            { name: 'category', value: FORM_INSTANCE_CATEGORY_SEARCH_PARAM },
            { name: 'status', value: 'current' },
          ],
        })
      ).unbundle();

      // `docStatus` has no search parameter, so the returned/still-a-draft distinction is drawn here.
      // Prefilled drafts are `preliminary`; only a form the provider returned is `final`.
      return new Set(
        docRefs
          .filter((docRef) => docRef.docStatus === 'final')
          .flatMap((docRef) => docRef.relatesTo ?? [])
          .map((relation) => relation.target?.reference?.replace('DocumentReference/', ''))
          .filter((id): id is string => !!id)
      );
    },
  });
};
