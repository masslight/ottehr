import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
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
  searchDisplay: string | null;
  isLoading: boolean;
}

function getSearchDisplay(mappedData: MappedItemData | null): string | null {
  if (!mappedData) return null;
  switch (mappedData.section) {
    case 'allergies':
      return mappedData.name;
    case 'medications':
      return mappedData.name;
    case 'conditions':
    case 'surgicalHistory':
    case 'episodeOfCare':
      return mappedData.display;
  }
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
        searchDisplay: null,
        isLoading: false,
      };
    }

    const match = matchStaticList(item.value, surgicalHistoryOptions as CPTCodeDTO[]);
    const mappedData = match ? { section: 'surgicalHistory' as const, code: match.code, display: match.display } : null;
    return {
      originalValue: item.value,
      mappedData,
      searchDisplay: getSearchDisplay(mappedData),
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
        searchDisplay: null,
        isLoading: false,
      };
    }

    const match = matchStaticList(item.value, HospitalizationOptions as HospitalizationDTO[]);
    const mappedData = match ? { section: 'episodeOfCare' as const, code: match.code, display: match.display } : null;
    return {
      originalValue: item.value,
      mappedData,
      searchDisplay: getSearchDisplay(mappedData),
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
      parseAiValue(item.value, section).map((v, childIndex) => ({
        ...item,
        value: v,
        __id: `${parentIndex}-${childIndex}`,
      }))
    );
  }, [aiGeneratedSuggestions, section]);

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
        items.map((item) => {
          const mappedData = resolvedRef.current.get(item.__id) ?? null;
          return {
            originalValue: item.value,
            mappedData,
            searchDisplay: getSearchDisplay(mappedData),
            isLoading: false,
          };
        })
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
            searchDisplay: null,
            isLoading: false,
          };
        }

        const mappedData = resolvedRef.current.get(item.__id) ?? null;
        return {
          originalValue: item.value,
          mappedData,
          searchDisplay: getSearchDisplay(mappedData),
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
              const query = normalizeMedicationName(item.value);
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
              searchDisplay: null,
              isLoading: false,
            };
          }

          const result = results[idx];

          if (result.status === 'fulfilled' && !result.value.cached) {
            const mappedData = result.value.data as MappedItemData | null;
            resolvedRef.current.set(item.__id, mappedData);
            return {
              originalValue: item.value,
              mappedData,
              searchDisplay: getSearchDisplay(mappedData),
              isLoading: false,
            };
          }

          const mappedData = resolvedRef.current.get(item.__id) ?? null;
          return {
            originalValue: item.value,
            mappedData,
            searchDisplay: getSearchDisplay(mappedData),
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

export function parseAiValue(value: string, section: AiSuggestionSection): string[] {
  if (!value) return [];

  return splitSentences(value)
    .filter((s) => isRelevantForSection(s, section))
    .map(cleanSentence)
    .flatMap((sentence) => smartSplit(sentence))
    .map(cleanItem)
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanSentence(text: string): string {
  return text
    .replace(/^the patient\s+/i, '')
    .replace(/^(she|he)\s+/i, '')
    .replace(/\b(currently|also)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRelevantForSection(text: string, section: AiSuggestionSection): boolean {
  const t = text.toLowerCase();

  // If the text has no sentence-like verbs it's likely a bare term (e.g. "Lisinopril 10mg",
  // "penicillin") that is already section-specific — keep it unconditionally.
  const hasSentenceVerb =
    /\b(takes?|taking|has|have|had|is|are|was|were|allerg|react|prescribed|denies|reports?)\b/.test(t);
  if (!hasSentenceVerb) return true;

  if (section === 'medications') {
    return /(take|taking|medication|drug|prescribed)/.test(t);
  }

  if (section === 'allergies') {
    return /(allergy|allergic|reaction)/.test(t);
  }

  if (section === 'conditions') {
    return !/(denies|no history|negative for)/.test(t);
  }

  return true;
}

function smartSplit(text: string): string[] {
  if (!text) return [];

  const cleaned = text.replace(/^the patient (currently )?(takes|has|reports|denies)\s+/i, '').replace(/\.$/, '');

  const commaParts = cleaned.split(',');

  return commaParts
    .flatMap((part, index) => {
      const trimmed = part.trim();

      if (index === commaParts.length - 1 && /\band\b/i.test(trimmed)) {
        return trimmed.split(/\band\b/i).map((p) => p.trim());
      }

      return [trimmed];
    })
    .filter(Boolean);
}

function cleanItem(text: string): string {
  return text
    .replace(/^\b(and|with|to)\b\s+/i, '')
    .replace(/^\b(takes|taking|has|have|had|experiences)\b\s+/i, '') // 👈 перенос сюда
    .replace(/\.$/, '')
    .trim();
}

export function normalizeMedicationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(last\s+time\s+(?:was\s+)?taken|last\s+taken|taken\s+on)\b.*/i, '')
    .replace(/\b\d{1,4}[.\-/]\d{1,2}[.\-/]\d{2,4}(?:\s+\d{1,2}:\d{2})?\b/g, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/\b\d+\s?(mg|ml|g|mcg|units?)\b/g, '')
    .replace(/\b(tablets?|capsules?|syrup|injection|cream)\b/g, '')
    .replace(/\b(forte|extra|plus|advance)\b/g, '')
    .replace(/[^a-z\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDoseNumber(value: string): string {
  const match = value.match(/\b(\d+)\s*(?:mg|ml|g|mcg|units?)\b/i);
  return match ? match[1] : '';
}

export function extractDoseFromValue(value: string): string | undefined {
  const match = value.match(/\b(\d+\s*(?:mg|ml|g|mcg|units?)(?:\s*\/\s*\d+\s*(?:mg|ml|g|mcg|units?))?)\b/i);
  return match ? match[1] : undefined;
}

export function extractDateFromValue(value: string): DateTime | undefined {
  const candidates: { pattern: RegExp; formats: string[] }[] = [
    {
      pattern: /\b(\d{1,2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})\b/,
      formats: ['d.MM.yyyy H:mm', 'dd.MM.yyyy HH:mm'],
    },
    { pattern: /\b(\d{1,2}\.\d{2}\.\d{4})\b/, formats: ['d.MM.yyyy', 'dd.MM.yyyy'] },
    {
      pattern: /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)\b/,
      formats: ["yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd'T'HH:mm:ss"],
    },
    { pattern: /\b(\d{4}-\d{2}-\d{2})\b/, formats: ['yyyy-MM-dd'] },
    { pattern: /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/, formats: ['M/d/yyyy', 'MM/dd/yyyy'] },
  ];

  for (const { pattern, formats } of candidates) {
    const match = value.match(pattern);
    if (!match) continue;
    for (const fmt of formats) {
      const dt = DateTime.fromFormat(match[1], fmt);
      if (dt.isValid) return dt;
    }
  }

  return undefined;
}

function selectBestMedication<T extends { strength?: string }>(results: T[], originalValue: string): T | null {
  if (results.length === 0) return null;
  const doseNumber = extractDoseNumber(originalValue);
  if (!doseNumber) return results[0];
  const match = results.find((r) => r.strength && r.strength.replace(/\s+/g, '').toLowerCase().includes(doseNumber));
  return match ?? results[0];
}
