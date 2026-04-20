import { AddCircleOutline, CheckCircle, InfoOutlined } from '@mui/icons-material';
import {
  Box,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { DocumentReference } from 'fhir/r4b';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { icd10Search } from 'src/api/api';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { AiSectionHeader } from 'src/features/visits/shared/components/AiSection';
import { SURGICAL_HISTORY_OPTIONS } from 'src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { getSource } from 'src/features/visits/shared/components/OttehrAi';
import { useChartDataArrayValue } from 'src/features/visits/shared/hooks/useChartDataArrayValue';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AiObservationField,
  AiSuggestionItem,
  AllergyDTO,
  CPTCodeDTO,
  GetChartDataResponse,
  HospitalizationDTO,
  MedicalConditionDTO,
  MedicationDTO,
  ObservationTextFieldDTO,
  ProcedureSuggestion,
} from 'utils';

interface SearchResult {
  id?: number;
  code?: string;
  name: string;
  strength?: string;
}

function filterStaticOptions(options: { display: string; code: string }[], term: string): SearchResult[] {
  const lower = term.toLowerCase();
  return options.filter((o) => o.display.toLowerCase().includes(lower)).map((o) => ({ name: o.display, code: o.code }));
}

type HighlightFieldType = 'medications' | 'allergies' | 'conditions' | 'surgicalHistory' | 'episodeOfCare' | null;

// ========================= HighlightedText (standalone memoized component) =========================

interface HighlightedTextProps {
  text: string;
  items?: AiSuggestionItem[];
  fieldType: HighlightFieldType;
  onAddResult: (
    fieldType: HighlightFieldType,
    result: SearchResult,
    dosageUnconfirmed: boolean,
    itemDisplay?: string
  ) => Promise<void>;
  onSearch: (fieldType: HighlightFieldType, item: AiSuggestionItem) => Promise<SearchResult[]>;
  searchCache?: Map<string, SearchResult[]>;
  emptySearchItems?: Set<string>;
  addedItems?: Set<string>;
  pendingItems?: Set<string>;
}

const HighlightedText = memo(function HighlightedText({
  text,
  items,
  fieldType,
  onAddResult,
  onSearch,
  searchCache,
  emptySearchItems,
  addedItems,
  pendingItems,
}: HighlightedTextProps): React.ReactElement {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [dosageUnconfirmed, setDosageUnconfirmed] = useState(true);

  const handleHighlightClick = useCallback(
    async (event: React.MouseEvent<HTMLElement>, item: AiSuggestionItem) => {
      if (!fieldType) return;
      setAnchorEl(event.currentTarget);
      setActiveItem(item.display);

      // Use cached results if available
      const cached = searchCache?.get(item.display);
      if (cached) {
        setSearchResults(cached);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      setSearchResults([]);
      try {
        const results = await onSearch(fieldType, item);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    },
    [fieldType, onSearch, searchCache]
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setActiveItem(null);
    setSearchResults([]);
    setDosageUnconfirmed(true);
  }, []);

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      if (fieldType) {
        await onAddResult(fieldType, result, dosageUnconfirmed, activeItem || undefined);
      }
      handleClose();
    },
    [fieldType, dosageUnconfirmed, handleClose, onAddResult, activeItem]
  );

  // Filter out items that returned no search results during pre-loading
  const activeItems = useMemo(
    () => (items || []).filter((item) => !emptySearchItems || !emptySearchItems.has(item.display)),
    [items, emptySearchItems]
  );

  if (activeItems.length === 0) {
    return <>{text}</>;
  }

  // Build a list of match ranges, case-insensitive, using display text for highlighting.
  // If the exact display doesn't match, try searchTerms and common variations as fallbacks.
  const ranges: { start: number; end: number; item: AiSuggestionItem }[] = [];
  const textLower = text.toLowerCase();
  for (const item of activeItems) {
    const candidates = [item.display, ...item.searchTerms, item.display.replace(/([a-z])([A-Z])/g, '$1 $2')];
    let matched = false;
    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < textLower.length) {
        const idx = textLower.indexOf(candidateLower, searchFrom);
        if (idx === -1) break;
        ranges.push({ start: idx, end: idx + candidate.length, item });
        searchFrom = idx + candidate.length;
        matched = true;
      }
      if (matched) break;
    }
  }

  if (ranges.length === 0) {
    return <>{text}</>;
  }

  // Sort by start position and merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      last.item = last.item || range.item;
    } else {
      merged.push({ ...range });
    }
  }

  // Build fragments
  const isClickable = !!fieldType;
  const fragments: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (cursor < range.start) {
      fragments.push(text.slice(cursor, range.start));
    }
    const isAdded = addedItems?.has(range.item.display);
    const isPending = pendingItems?.has(range.item.display);
    fragments.push(
      <Box
        component="span"
        key={range.start}
        onClick={isClickable && !isPending ? (e) => handleHighlightClick(e, range.item) : undefined}
        sx={{
          backgroundColor: isAdded ? 'rgba(76, 175, 80, 0.15)' : 'rgba(25, 118, 210, 0.15)',
          borderRadius: '3px',
          padding: '1px 2px',
          ...(isClickable && !isPending
            ? {
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: isAdded ? 'rgba(76, 175, 80, 0.3)' : 'rgba(25, 118, 210, 0.3)',
                },
              }
            : {}),
          ...(isPending ? { cursor: 'wait', opacity: 0.7 } : {}),
        }}
      >
        {text.slice(range.start, range.end)}
        {isPending ? (
          <CircularProgress size={12} sx={{ ml: 0.25, verticalAlign: 'middle' }} />
        ) : (
          isAdded && <CheckCircle sx={{ fontSize: 12, color: 'success.main', ml: 0.25, verticalAlign: 'middle' }} />
        )}
      </Box>
    );
    cursor = range.end;
  }
  if (cursor < text.length) {
    fragments.push(text.slice(cursor));
  }

  return (
    <>
      {fragments}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxHeight: 300, minWidth: 280, maxWidth: 400 } } }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, fontWeight: 700 }}>
            Matches for &ldquo;{activeItem}&rdquo;
          </Typography>
          {searchLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : searchResults.length === 0 ? (
            <Typography variant="body2" sx={{ px: 1, py: 1, color: 'text.secondary' }}>
              No matches found
            </Typography>
          ) : (
            <>
              {fieldType === 'medications' && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={dosageUnconfirmed}
                      onChange={(e) => setDosageUnconfirmed(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption">Dosage unconfirmed</Typography>}
                  sx={{ px: 1, mb: 0.5 }}
                />
              )}
              <List dense disablePadding>
                {searchResults.slice(0, 15).map((result, idx) => (
                  <ListItemButton
                    key={`${result.name}-${result.code || result.id || idx}`}
                    sx={{ borderRadius: 1 }}
                    onClick={() => handleSelectResult(result)}
                  >
                    <ListItemText
                      primary={result.name}
                      secondary={result.strength || undefined}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
});

// ========================= AiSuggestion =========================

export interface AiSuggestionProps {
  title: string;
  chartData?: GetChartDataResponse | undefined;
  content?: ObservationTextFieldDTO[];
  procedureSuggestions?: ProcedureSuggestion[];
  loading?: boolean;
  hideHeader?: boolean;
  onAppendToNote?: (text: string, resourceId?: string) => void;
  appendedNoteIds?: Set<string>;
}

export default function AiSuggestion({
  title,
  chartData,
  content,
  procedureSuggestions,
  loading,
  hideHeader,
  onAppendToNote,
  appendedNoteIds,
}: AiSuggestionProps): React.ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const theme = useTheme();

  const highlightFieldType: HighlightFieldType = useMemo(() => {
    const field = content?.[0]?.field;
    if (field === AiObservationField.MedicationsHistory || field === AiObservationField.eRX) return 'medications';
    if (field === AiObservationField.Allergies) return 'allergies';
    if (field === AiObservationField.PastMedicalHistory) return 'conditions';
    if (field === AiObservationField.PastSurgicalHistory) return 'surgicalHistory';
    if (field === AiObservationField.HospitalizationsHistory) return 'episodeOfCare';
    return null;
  }, [content]);

  const { onSubmit: addMedication } = useChartDataArrayValue('medications', undefined, {
    _sort: '-_lastUpdated',
    _include: 'MedicationStatement:source',
    status: { type: 'token', value: 'active' },
  });

  const { onSubmit: addAllergy } = useChartDataArrayValue('allergies');
  const { onSubmit: addCondition } = useChartDataArrayValue('conditions');
  const { onSubmit: addSurgicalHistory } = useChartDataArrayValue('surgicalHistory', undefined, {});
  const { onSubmit: addHospitalization } = useChartDataArrayValue('episodeOfCare', undefined, {});

  // Stable callback for searching — passed to HighlightedText
  const handleSearch = useCallback(
    async (fieldType: HighlightFieldType, item: AiSuggestionItem): Promise<SearchResult[]> => {
      const allResults: SearchResult[] = [];
      const seen = new Set<string>();

      const preferredTerms =
        fieldType === 'surgicalHistory' || fieldType === 'episodeOfCare'
          ? [item.display, ...item.searchTerms.filter((t) => t.toLowerCase() !== item.display.toLowerCase())]
          : item.searchTerms;
      const termsToSearch = preferredTerms.length > 0 ? preferredTerms : item.display ? [item.display] : [];
      if (termsToSearch.length === 0) return [];
      const maxPerTerm = Math.max(5, Math.floor(15 / termsToSearch.length));

      for (const term of termsToSearch) {
        let results: SearchResult[] = [];
        if (fieldType === 'medications' && oystehr) {
          results = await oystehr.erx.searchMedications({ name: term });
        } else if (fieldType === 'allergies' && oystehr) {
          results = await oystehr.erx.searchAllergens({ name: term });
        } else if (fieldType === 'conditions' && oystehrZambda) {
          const response = await icd10Search(oystehrZambda, { search: term });
          results = (response.codes || []).map((c) => ({ name: c.display, code: c.code }));
        } else if (fieldType === 'surgicalHistory') {
          results = filterStaticOptions(SURGICAL_HISTORY_OPTIONS, term);
        } else if (fieldType === 'episodeOfCare') {
          results = filterStaticOptions(HospitalizationOptions, term);
        }
        let added = 0;
        for (const r of results) {
          if (added >= maxPerTerm) break;
          const key = r.name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allResults.push(r);
            added++;
          }
        }
      }
      return allResults;
    },
    [oystehr, oystehrZambda]
  );

  // Pre-load search results for all items across all observations.
  // Uses refs to avoid re-renders while popover is open (which would destroy the anchor element).
  // A single state update at the end triggers one re-render to hide items with no results.
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const emptySearchItemsRef = useRef<Set<string>>(new Set());
  const [preloadComplete, setPreloadComplete] = useState(false);
  const preloadedRef = useRef<Set<string>>(new Set());

  const searchCache = searchCacheRef.current;
  const emptySearchItems = preloadComplete ? emptySearchItemsRef.current : undefined;

  useEffect(() => {
    if (!highlightFieldType || !content) return;

    const allItems: AiSuggestionItem[] = [];
    for (const obs of content) {
      if ('items' in obs && obs.items) {
        for (const item of obs.items) {
          if (!preloadedRef.current.has(item.display)) {
            allItems.push(item);
            preloadedRef.current.add(item.display);
          }
        }
      }
    }

    if (allItems.length === 0) return;

    const preload = async (): Promise<void> => {
      await Promise.all(
        allItems.map(async (item) => {
          try {
            const results = await handleSearch(highlightFieldType, item);
            if (results.length > 0) {
              searchCacheRef.current.set(item.display, results);
            } else {
              emptySearchItemsRef.current.add(item.display);
            }
          } catch {
            emptySearchItemsRef.current.add(item.display);
          }
        })
      );

      setPreloadComplete(true);
    };

    void preload();
  }, [highlightFieldType, content, handleSearch]);

  // Track which highlighted items have been added to the chart
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  // Track items whose save is in flight, so we can show a spinner
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());

  // Stable callback for adding a result to the chart — passed to HighlightedText
  const handleAddResult = useCallback(
    async (
      fieldType: HighlightFieldType,
      result: SearchResult,
      dosageUnconfirmed: boolean,
      itemDisplay?: string
    ): Promise<void> => {
      if (itemDisplay) {
        setPendingItems((prev) => new Set(prev).add(itemDisplay));
      }
      try {
        if (fieldType === 'medications') {
          const strength = result.strength;
          const nameHasStrength = strength && result.name.toLowerCase().includes(strength.toLowerCase());
          const displayName = nameHasStrength || !strength ? result.name : `${result.name} (${strength})`;
          await addMedication({
            name: displayName,
            id: result.id?.toString(),
            type: 'scheduled',
            intakeInfo: {
              patientCouldNotConfirmDosage: dosageUnconfirmed || undefined,
            },
            status: 'active',
          } as MedicationDTO);
        } else if (fieldType === 'allergies') {
          await addAllergy({
            name: result.name,
            id: result.id?.toString(),
            current: true,
            lastUpdated: new Date().toISOString(),
          } as AllergyDTO);
        } else if (fieldType === 'conditions') {
          await addCondition({
            code: result.code,
            display: result.name,
            current: true,
            lastUpdated: new Date().toISOString(),
          } as MedicalConditionDTO);
        } else if (fieldType === 'surgicalHistory' || fieldType === 'episodeOfCare') {
          const addFn = fieldType === 'surgicalHistory' ? addSurgicalHistory : addHospitalization;
          await addFn({ code: result.code, display: result.name } as CPTCodeDTO & HospitalizationDTO);
        }
        if (itemDisplay) {
          setAddedItems((prev) => new Set(prev).add(itemDisplay));
        }
      } catch (err) {
        console.error('Failed to add item:', err);
      } finally {
        if (itemDisplay) {
          setPendingItems((prev) => {
            const next = new Set(prev);
            next.delete(itemDisplay);
            return next;
          });
        }
      }
    },
    [addMedication, addAllergy, addCondition, addSurgicalHistory, addHospitalization]
  );

  function getDocumentReferenceSource(
    observation: ObservationTextFieldDTO,
    documentReferences: DocumentReference[]
  ): DocumentReference | undefined {
    return documentReferences.find((document) => document.id === observation.derivedFrom?.split('/')[1]);
  }

  function SuggestionsItem(): React.ReactElement {
    if (procedureSuggestions) {
      return (
        <>
          {procedureSuggestions.map((code) => (
            <>
              <Typography variant="body1">
                <strong>{code.code}</strong> &ndash; {code.description}
                <Tooltip title={code.useWhen}>
                  <IconButton size="small" sx={{ marginLeft: '5px' }}>
                    <InfoOutlined sx={{ fontSize: '17px' }} />
                  </IconButton>
                </Tooltip>
              </Typography>
            </>
          ))}
        </>
      );
    }
    return (
      <>
        {content
          ?.sort((a, b) => {
            if (!chartData?.aiChat?.documents) {
              return 0;
            }
            const documentSourceA = getDocumentReferenceSource(a, chartData.aiChat.documents);
            const documentSourceB = getDocumentReferenceSource(b, chartData.aiChat.documents);
            if (!documentSourceA || !documentSourceA.date) {
              return 0;
            }
            if (!documentSourceB || !documentSourceB.date) {
              return 0;
            }
            return new Date(documentSourceA.date).getTime() - new Date(documentSourceB.date).getTime();
          })
          .map((item) => {
            const documentSource = chartData?.aiChat?.documents
              ? getDocumentReferenceSource(item, chartData.aiChat.documents)
              : undefined;
            return (
              <Box sx={{ paddingBottom: '15px' }} key={item.resourceId}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" style={{ color: theme.palette.secondary.light }}>
                    {documentSource
                      ? getSource(documentSource, oystehr, chartData?.aiChat?.providers)
                      : 'source is unknown'}
                  </Typography>
                  {onAppendToNote && item.resourceId && appendedNoteIds?.has(item.resourceId) ? (
                    <CheckCircle sx={{ fontSize: 16, color: 'success.main', ml: 0.25 }} />
                  ) : onAppendToNote ? (
                    <Tooltip title="Add to note">
                      <IconButton
                        size="small"
                        onClick={() => onAppendToNote(item.value, item.resourceId)}
                        sx={{ padding: '2px', color: theme.palette.primary.main }}
                      >
                        <AddCircleOutline sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Box>
                <Typography variant="body1">
                  <HighlightedText
                    text={item.value}
                    items={'items' in item ? item.items : undefined}
                    fieldType={highlightFieldType}
                    onSearch={handleSearch}
                    onAddResult={handleAddResult}
                    searchCache={searchCache}
                    emptySearchItems={emptySearchItems}
                    addedItems={addedItems}
                    pendingItems={pendingItems}
                  />
                </Typography>
              </Box>
            );
          })}
      </>
    );
  }

  if (hideHeader) {
    return <SuggestionsItem />;
  }

  return (
    <Box sx={{ marginBottom: '10px' }}>
      <Container
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '4px 8px 4px 8px',
          marginBottom: '8px',
        }}
      >
        <AiSectionHeader />
      </Container>
      <Container
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '4px 8px 4px 8px',
        }}
      >
        <Container style={{ display: 'flex', alignItems: 'center', padding: 0 }}>
          <Typography variant="body1" style={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {loading && <CircularProgress size={17} style={{ marginLeft: '7px' }} />}
        </Container>
        <SuggestionsItem />
      </Container>
    </Box>
  );
}
