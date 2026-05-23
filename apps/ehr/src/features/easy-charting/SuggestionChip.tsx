import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Chip, CircularProgress, List, ListItemButton, ListItemText, Popover, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { useCallback, useState } from 'react';
import { icd10Search } from 'src/api/api';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from 'src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AllergyDTO,
  ChartPlanAddition,
  CPTCodeDTO,
  HospitalizationDTO,
  MedicalConditionDTO,
  MedicationDTO,
  SaveChartDataRequest,
} from 'utils';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';

interface SearchResult {
  id?: string | number;
  code?: string;
  name: string;
  strength?: string;
}

type SuggestionKind = Extract<
  ChartPlanAddition,
  | { kind: 'dx-suggestion' }
  | { kind: 'condition-suggestion' }
  | { kind: 'allergy-suggestion' }
  | { kind: 'medication-suggestion' }
  | { kind: 'surgical-history-suggestion' }
  | { kind: 'hospitalization-suggestion' }
>['kind'];

interface SuggestionChipProps {
  encounterId: string;
  kind: SuggestionKind;
  display: string;
  searchTerms: string[];
  isPrimary?: boolean;
}

function filterStaticOptions(options: { display: string; code: string }[], term: string): SearchResult[] {
  const lower = term.toLowerCase();
  return options.filter((o) => o.display.toLowerCase().includes(lower)).map((o) => ({ name: o.display, code: o.code }));
}

async function runSearch(
  kind: SuggestionKind,
  searchTerms: string[],
  display: string,
  oystehr: Oystehr | undefined,
  oystehrZambda: Oystehr | undefined
): Promise<SearchResult[]> {
  const terms = searchTerms.length > 0 ? searchTerms : [display];
  const all: SearchResult[] = [];
  const seen = new Set<string>();
  const perTerm = Math.max(5, Math.floor(15 / terms.length));

  for (const term of terms) {
    let results: SearchResult[] = [];
    if ((kind === 'condition-suggestion' || kind === 'dx-suggestion') && oystehrZambda) {
      const response = await icd10Search(oystehrZambda, { search: term });
      results = (response.codes || []).map((c) => ({ name: c.display, code: c.code }));
    } else if (kind === 'medication-suggestion' && oystehr) {
      results = (await oystehr.erx.searchMedications({ name: term })) as SearchResult[];
    } else if (kind === 'allergy-suggestion' && oystehr) {
      results = (await oystehr.erx.searchAllergens({ name: term })) as SearchResult[];
    } else if (kind === 'surgical-history-suggestion') {
      results = filterStaticOptions(SURGICAL_HISTORY_OPTIONS, term);
    } else if (kind === 'hospitalization-suggestion') {
      results = filterStaticOptions(HospitalizationOptions, term);
    }
    let added = 0;
    for (const r of results) {
      if (added >= perTerm) break;
      const key = (r.code ?? r.name).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(r);
        added++;
      }
    }
  }
  return all;
}

function buildPayload(
  encounterId: string,
  kind: SuggestionKind,
  result: SearchResult,
  isPrimary: boolean
): SaveChartDataRequest | null {
  if (kind === 'dx-suggestion' && result.code) {
    return { encounterId, diagnosis: [{ code: result.code, display: result.name, isPrimary }] };
  }
  if (kind === 'condition-suggestion' && result.code) {
    return {
      encounterId,
      conditions: [{ code: result.code, display: result.name, current: true } satisfies MedicalConditionDTO],
    };
  }
  if (kind === 'allergy-suggestion') {
    return {
      encounterId,
      allergies: [
        {
          name: result.name,
          id: result.id != null ? String(result.id) : undefined,
          current: true,
        } satisfies AllergyDTO,
      ],
    };
  }
  if (kind === 'medication-suggestion') {
    const strength = result.strength;
    const nameHasStrength = strength && result.name.toLowerCase().includes(strength.toLowerCase());
    const name = nameHasStrength || !strength ? result.name : `${result.name} (${strength})`;
    return {
      encounterId,
      medications: [
        {
          name,
          id: result.id != null ? String(result.id) : undefined,
          type: 'scheduled',
          status: 'active',
          intakeInfo: {},
        } satisfies MedicationDTO,
      ],
    };
  }
  if (kind === 'surgical-history-suggestion' && result.code) {
    return {
      encounterId,
      surgicalHistory: [{ code: result.code, display: result.name } satisfies CPTCodeDTO],
    };
  }
  if (kind === 'hospitalization-suggestion' && result.code) {
    return {
      encounterId,
      episodeOfCare: [{ code: result.code, display: result.name } satisfies HospitalizationDTO],
    };
  }
  return null;
}

export default function SuggestionChip({
  encounterId,
  kind,
  display,
  searchTerms,
  isPrimary = false,
}: SuggestionChipProps): JSX.Element {
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<SearchResult | null>(null);

  const open = Boolean(anchorEl);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLElement>) => {
      if (savedResult || saving) return;
      setAnchorEl(e.currentTarget);
      if (results.length > 0) return;
      setSearching(true);
      try {
        const r = await runSearch(kind, searchTerms, display, oystehr, oystehrZambda);
        setResults(r);
      } catch (err) {
        console.error('Search failed for', display, err);
      } finally {
        setSearching(false);
      }
    },
    [savedResult, saving, results.length, kind, searchTerms, display, oystehr, oystehrZambda]
  );

  const handleSelect = useCallback(
    async (result: SearchResult): Promise<void> => {
      if (!apiClient) return;
      setSaving(true);
      try {
        const payload = buildPayload(encounterId, kind, result, isPrimary);
        if (payload) {
          await apiClient.saveChartData(payload);
          setSavedResult(result);
        }
      } catch (err) {
        console.error('Save failed:', err);
      } finally {
        setSaving(false);
        setAnchorEl(null);
      }
    },
    [apiClient, encounterId, kind, isPrimary]
  );

  const label = savedResult ? savedResult.name : display;

  return (
    <>
      <Chip
        size="small"
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {label}
            {isPrimary && kind === 'dx-suggestion' && !savedResult && (
              <Typography variant="caption" sx={{ ml: 0.5, opacity: 0.7 }}>
                (primary)
              </Typography>
            )}
            {saving && <CircularProgress size={12} sx={{ ml: 0.5 }} />}
            {savedResult && <CheckCircleIcon sx={{ fontSize: 14, ml: 0.5 }} />}
          </Box>
        }
        onClick={handleClick}
        disabled={!!savedResult}
        sx={{
          cursor: savedResult ? 'default' : 'pointer',
          bgcolor: savedResult ? 'success.light' : 'primary.light',
          color: savedResult ? 'success.contrastText' : 'primary.contrastText',
          '&.Mui-disabled': {
            bgcolor: 'success.light',
            color: 'success.contrastText',
            opacity: 1,
          },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxWidth: 360, maxHeight: 360 } } }}
      >
        {searching ? (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No matches found for &ldquo;{display}&rdquo;.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }}>
            {results.map((r, i) => (
              <ListItemButton key={`${r.code ?? r.id ?? i}`} onClick={() => handleSelect(r)} disabled={saving}>
                <ListItemText
                  primary={r.name + (r.strength ? ` — ${r.strength}` : '')}
                  secondary={r.code}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
