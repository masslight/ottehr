import Oystehr from '@oystehr/sdk';
import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ValueSet } from 'fhir/r4b';
import { QUERY_STALE_TIME } from 'src/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  SUPPLIES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  TIME_SPENT_VALUE_SET_URL,
} from 'utils/lib/types/api/procedures.constants';

export interface ProcedureType {
  name: string;
  code: string;
}

export interface SelectOptions {
  procedureTypes: ProcedureType[];
  medicationsUsed: string[];
  bodySites: string[];
  bodySides: string[];
  techniques: string[];
  supplies: string[];
  complications: string[];
  patientResponses: string[];
  postProcedureInstructions: string[];
  timeSpent: string[];
}

const emptySelectOptions: SelectOptions = {
  procedureTypes: [],
  medicationsUsed: [],
  bodySites: [],
  bodySides: [],
  techniques: [],
  supplies: [],
  complications: [],
  patientResponses: [],
  postProcedureInstructions: [],
  timeSpent: [],
};

export function latestValueSet(valueSetUrl: string, valueSets: ValueSet[] | undefined): ValueSet | undefined {
  return (valueSets ?? [])
    .filter((valueSet) => valueSet.url === valueSetUrl)
    .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? '', undefined, { numeric: true }))
    .at(-1);
}

function getValueSetValues(valueSetUrl: string, valueSets: ValueSet[] | undefined): string[] {
  const valueSet = latestValueSet(valueSetUrl, valueSets);
  return (valueSet?.expansion?.contains?.flatMap((item) => (item.display != null ? [item.display] : [])) ?? []).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

function getProcedureTypes(valueSets: ValueSet[] | undefined): ProcedureType[] {
  const latest = latestValueSet(PROCEDURE_TYPES_VALUE_SET_URL, valueSets);
  if (!latest?.expansion?.contains) return [];

  return latest.expansion.contains
    .map((item): ProcedureType | null => {
      if (!item.display || !item.code) return null;

      // Procedure types carry no default billing code: the coding engine and the AI fallback are
      // the only code sources, so nothing is read off the concept beyond its name and code.
      return { name: item.display, code: item.code };
    })
    .filter((p): p is ProcedureType => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function useProcedureSelectOptions(oystehr: Oystehr | undefined): UseQueryResult<SelectOptions, Error> {
  return useQuery({
    queryKey: ['procedures-new-dropdown-options'],
    enabled: oystehr != null,

    queryFn: async (): Promise<SelectOptions> => {
      if (oystehr == null) {
        return emptySelectOptions;
      }
      const valueSets = await getAllFhirSearchPages<ValueSet>(
        {
          resourceType: 'ValueSet',
          params: [
            {
              name: 'url',
              value: [
                PROCEDURE_TYPES_VALUE_SET_URL,
                MEDICATIONS_USED_VALUE_SET_URL,
                BODY_SITES_VALUE_SET_URL,
                BODY_SIDES_VALUE_SET_URL,
                TECHNIQUES_VALUE_SET_URL,
                SUPPLIES_VALUE_SET_URL,
                COMPLICATIONS_VALUE_SET_URL,
                PATIENT_RESPONSES_VALUE_SET_URL,
                POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
                TIME_SPENT_VALUE_SET_URL,
              ].join(','),
            },
          ],
        },
        oystehr
      );
      return {
        procedureTypes: getProcedureTypes(valueSets),
        medicationsUsed: getValueSetValues(MEDICATIONS_USED_VALUE_SET_URL, valueSets),
        bodySites: getValueSetValues(BODY_SITES_VALUE_SET_URL, valueSets),
        bodySides: getValueSetValues(BODY_SIDES_VALUE_SET_URL, valueSets),
        techniques: getValueSetValues(TECHNIQUES_VALUE_SET_URL, valueSets),
        supplies: getValueSetValues(SUPPLIES_VALUE_SET_URL, valueSets),
        complications: getValueSetValues(COMPLICATIONS_VALUE_SET_URL, valueSets),
        patientResponses: getValueSetValues(PATIENT_RESPONSES_VALUE_SET_URL, valueSets),
        postProcedureInstructions: getValueSetValues(POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL, valueSets),
        timeSpent: getValueSetValues(TIME_SPENT_VALUE_SET_URL, valueSets),
      };
    },
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
}
