import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { icd10Search } from 'src/api/api';
import { surgicalHistoryOptions } from 'src/constants/surgical-history-options';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { useApiClients } from 'src/hooks/useAppClients';
import { CPTCodeDTO, HospitalizationDTO, ObservationTextFieldDTO } from 'utils';
import { ExtractObjectType } from '../stores/appointment/appointment.queries';

export type AiSuggestionSection = 'allergies' | 'medications' | 'conditions' | 'surgicalHistory' | 'episodeOfCare';

export type MappedItemData =
  | { section: 'allergies'; name: string; id?: string }
  | { section: 'conditions'; code: string; display: string }
  | { section: 'surgicalHistory'; code: string; display: string }
  | { section: 'episodeOfCare'; code: string; display: string }
  | ({ section: 'medications' } & ExtractObjectType<ErxSearchMedicationsResponse>);

export interface MappedSuggestion {
  originalValue: string;
  mappedData: MappedItemData | null;
  isLoading: boolean;
}

function matchStaticList<T extends { display: string }>(term: string, options: T[]): T | null {
  const lowerTerm = term.toLowerCase().trim();
  const matches = options.filter(
    (opt) =>
      opt.display !== 'Other' &&
      (opt.display.toLowerCase().includes(lowerTerm) || lowerTerm.includes(opt.display.toLowerCase()))
  );
  if (matches.length === 0) return null;
  // Pick the shortest display for closest match
  return matches.sort((a, b) => a.display.length - b.display.length)[0];
}

function mapSurgicalHistory(items: ObservationTextFieldDTO[]): MappedSuggestion[] {
  return items.map((item) => {
    if (shouldSkipMapping(item.value)) {
      return {
        originalValue: item.value,
        mappedData: null,
        isLoading: false,
      };
    }

    const match = matchStaticList(item.value, surgicalHistoryOptions as CPTCodeDTO[]);
    return {
      originalValue: item.value,
      mappedData: match ? { section: 'surgicalHistory' as const, code: match.code, display: match.display } : null,
      isLoading: false,
    };
  });
}

function mapHospitalizations(items: ObservationTextFieldDTO[]): MappedSuggestion[] {
  return items.map((item) => {
    if (shouldSkipMapping(item.value)) {
      return {
        originalValue: item.value,
        mappedData: null,
        isLoading: false,
      };
    }

    const match = matchStaticList(item.value, HospitalizationOptions as HospitalizationDTO[]);
    return {
      originalValue: item.value,
      mappedData: match ? { section: 'episodeOfCare' as const, code: match.code, display: match.display } : null,
      isLoading: false,
    };
  });
}

export function useAiSuggestionMapping(
  aiGeneratedSuggestions: ObservationTextFieldDTO[] | undefined,
  section: AiSuggestionSection
): MappedSuggestion[] {
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [apiResults, setApiResults] = useState<MappedSuggestion[]>([]);
  const resolvedRef = useRef<Map<string, MappedItemData | null>>(new Map());

  const items = useMemo(() => {
    if (!aiGeneratedSuggestions) return [];

    return aiGeneratedSuggestions.flatMap((item, parentIndex) =>
      splitAiValue(item.value).map((v, childIndex) => ({
        ...item,
        value: v,
        __id: `${parentIndex}-${childIndex}`,
      }))
    );
  }, [aiGeneratedSuggestions]);

  const itemsKey = useMemo(() => items.map((i) => i.__id + ':' + i.value).join('\n') ?? '', [items]);

  const staticResult = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (section === 'surgicalHistory') return mapSurgicalHistory(items);
    if (section === 'episodeOfCare') return mapHospitalizations(items);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, section]);

  useEffect(() => {
    if (!items || items.length === 0 || staticResult !== null) return;

    const allResolved = items.every((item) => shouldSkipMapping(item.value) || resolvedRef.current.has(item.__id));
    if (allResolved) {
      setApiResults(
        items.map((item) => ({
          originalValue: item.value,
          mappedData: resolvedRef.current.get(item.__id) ?? null,
          isLoading: false,
        }))
      );
      return;
    }

    // Initialize loading state
    setApiResults(
      items.map((item) => {
        if (shouldSkipMapping(item.value)) {
          return {
            originalValue: item.value,
            mappedData: null,
            isLoading: false,
          };
        }

        return {
          originalValue: item.value,
          mappedData: resolvedRef.current.get(item.__id) ?? null,
          isLoading: !resolvedRef.current.has(item.__id),
        };
      })
    );

    const fetchMappings = async (): Promise<void> => {
      const results = await Promise.allSettled(
        items.map(async (item, index) => {
          if (shouldSkipMapping(item.value)) {
            return { index, data: null, skipped: true };
          }

          if (resolvedRef.current.has(item.__id)) {
            return { index, data: resolvedRef.current.get(item.__id) ?? null, cached: true };
          }

          try {
            if (section === 'allergies' && oystehr) {
              const response = await queryClient.fetchQuery({
                queryKey: ['allergies-search', item.value.toLowerCase()],
                queryFn: () => oystehr.erx.searchAllergens({ name: item.value }),
                staleTime: 5 * 60 * 1000,
              });
              const first = response?.[0];
              return {
                index,
                data: first ? { section: 'allergies' as const, name: first.name, id: first.id?.toString() } : null,
              };
            }

            if (section === 'medications' && oystehr) {
              const query = extractMedicationName(item.value);

              const response = await queryClient.fetchQuery({
                queryKey: ['medications-search', query],
                queryFn: () => oystehr.erx.searchMedications({ name: query }),
                staleTime: 5 * 60 * 1000,
              });
              const best = selectBestMedication(response ?? [], item.value);
              return {
                index,
                data: best ? { section: 'medications' as const, ...best } : null,
              };
            }

            if (section === 'conditions' && oystehrZambda) {
              const response = await queryClient.fetchQuery({
                queryKey: ['icd-10-search', item.value.toLowerCase()],
                queryFn: () => icd10Search(oystehrZambda, { search: item.value }),
                staleTime: 5 * 60 * 1000,
              });
              const first = response?.codes?.[0];
              return {
                index,
                data: first ? { section: 'conditions' as const, code: first.code, display: first.display } : null,
              };
            }

            return { index, data: null };
          } catch {
            return { index, data: null };
          }
        })
      );

      setApiResults(
        items.map((item, idx) => {
          if (shouldSkipMapping(item.value)) {
            return {
              originalValue: item.value,
              mappedData: null,
              isLoading: false,
            };
          }

          const result = results[idx];

          if (result.status === 'fulfilled' && !result.value.cached) {
            const mappedData = result.value.data as MappedItemData | null;
            resolvedRef.current.set(item.__id, mappedData);
            return { originalValue: item.value, mappedData, isLoading: false };
          }

          return {
            originalValue: item.value,
            mappedData: resolvedRef.current.get(item.__id) ?? null,
            isLoading: false,
          };
        })
      );
    };

    void fetchMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, section, oystehr, oystehrZambda]);

  if (staticResult !== null) return staticResult;
  return apiResults;
}

const NEGATIONS = ['denies', 'no ', 'none', 'without', 'negative for'];
const VAGUE_PATTERNS = ['history of', 'family history', 'possible', 'suspected', 'rule out'];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function isNegated(text: string): boolean {
  const t = normalize(text);
  return NEGATIONS.some((n) => t.includes(n));
}

function isTooVague(text: string): boolean {
  const t = normalize(text);
  return VAGUE_PATTERNS.some((p) => t.includes(p));
}

function shouldSkipMapping(text: string): boolean {
  return !text || isNegated(text) || isTooVague(text);
}

export function splitAiValue(value: string): string[] {
  if (!value) return [];

  return value
    .replace(/\.$/, '')
    .split(/,| and /i)
    .map((v) => v.trim())
    .filter(Boolean);
}

function extractMedicationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\d+\s?(mg|ml|g|mcg|units?)\b/g, '')
    .replace(/\b\d+\b/g, '')
    .trim();
}

function extractDoseNumber(value: string): string {
  const match = value.match(/\b(\d+)\s*(?:mg|ml|g|mcg|units?)\b/i);
  return match ? match[1] : '';
}

function selectBestMedication<T extends { strength?: string }>(results: T[], originalValue: string): T | null {
  if (results.length === 0) return null;
  const doseNumber = extractDoseNumber(originalValue);
  if (!doseNumber) return results[0];
  const match = results.find((r) => r.strength && r.strength.replace(/\s+/g, '').toLowerCase().includes(doseNumber));
  return match ?? results[0];
}
