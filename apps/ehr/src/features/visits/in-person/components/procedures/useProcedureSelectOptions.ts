import Oystehr from '@oystehr/sdk';
import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ValueSet } from 'fhir/r4b';
import { QUERY_STALE_TIME } from 'src/constants';
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
} from 'utils';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';

export interface ProcedureType {
  name: string;
  code: string;
  cpt?: {
    code: string;
    display: string;
    system?: string;
  };
  hcpcs?: {
    code: string;
    display: string;
    system?: string;
  };
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
  return valueSet?.expansion?.contains?.flatMap((item) => (item.display != null ? [item.display] : [])) ?? [];
}

function getProcedureTypes(valueSets: ValueSet[] | undefined): ProcedureType[] {
  const latest = latestValueSet(PROCEDURE_TYPES_VALUE_SET_URL, valueSets);
  if (!latest?.expansion?.contains) return [];

  return latest.expansion.contains
    .map((item): ProcedureType | null => {
      if (!item.display || !item.code) return null;

      const getCode = (urlPart: string): { code: string; display: string; system?: string } | undefined => {
        const coding = item.extension?.find((ext) => ext.url?.includes(urlPart))?.valueCodeableConcept?.coding?.[0];

        return coding?.code && coding?.display
          ? { code: coding.code, display: coding.display, system: coding.system }
          : undefined;
      };

      return {
        name: item.display,
        code: item.code,
        cpt: getCode('procedure-type-cpt'),
        hcpcs: getCode('procedure-type-hcpcs'),
      };
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
