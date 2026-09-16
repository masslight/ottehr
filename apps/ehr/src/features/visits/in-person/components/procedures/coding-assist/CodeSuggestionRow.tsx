import { AddCircleOutline, CheckCircle, InfoOutlined } from '@mui/icons-material';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { CodeSuggestion, CPTCodeDTO } from 'utils';

export const stripCodePrefix = (display: string, code: string): string =>
  display.startsWith(code) ? display.slice(code.length).replace(/^\s*[—–-]\s*/, '') : display;

interface CodeSuggestionRowProps {
  suggestion: CodeSuggestion;
  source?: 'rules' | 'ai';
  isReadOnly: boolean;
  selectedCodes: CPTCodeDTO[];
  onAddCodes: (entries: CPTCodeDTO[]) => void;
}

export const CodeSuggestionRow: FC<CodeSuggestionRowProps> = ({
  suggestion,
  source = 'rules',
  isReadOnly,
  selectedCodes,
  onAddCodes,
}) => {
  const { oystehr } = useApiClients();
  const { data: officialDescriptions, isFetching: isLoadingDescriptions } = useQuery({
    queryKey: ['procedure-code-descriptions', suggestion.code, ...(suggestion.addOns ?? []).map((line) => line.code)],
    enabled: source === 'rules' && !!oystehr,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const codes = [suggestion.code, ...(suggestion.addOns ?? []).map((line) => line.code)];
      const matches = await Promise.all(
        codes.map(async (code) => {
          const search = /^[A-Z]/.test(code) ? oystehr!.terminology.searchHcpcs : oystehr!.terminology.searchCpt;
          const response = await search.call(oystehr!.terminology, { query: code, searchType: 'all', limit: 100 });
          return [code, response.codes.find((item) => item.code === code)?.display] as const;
        })
      );
      return Object.fromEntries(matches);
    },
  });
  const entries: CPTCodeDTO[] = [
    {
      code: suggestion.code,
      display: stripCodePrefix(officialDescriptions?.[suggestion.code] ?? suggestion.display, suggestion.code),
      ...(suggestion.units !== undefined ? { billableUnits: suggestion.units } : {}),
      ...(suggestion.modifiers?.length
        ? { modifier: suggestion.modifiers.map((code) => ({ code, display: code })) }
        : {}),
    },
    ...(suggestion.addOns ?? []).map((addOn) => ({
      code: addOn.code,
      display: stripCodePrefix(officialDescriptions?.[addOn.code] ?? addOn.display, addOn.code),
      billableUnits: addOn.units,
    })),
  ];

  const allAdded = entries.every((entry) =>
    selectedCodes.some(
      (selected) =>
        selected.code === entry.code &&
        (selected.billableUnits ?? 1) === (entry.billableUnits ?? 1) &&
        (selected.modifier ?? [])
          .map((m) => m.code)
          .sort()
          .join(',') ===
          (entry.modifier ?? [])
            .map((m) => m.code)
            .sort()
            .join(',')
    )
  );

  return (
    <Box data-testid={dataTestIds.documentProcedurePage.bestMatchCptCode}>
      <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'success.dark' }}>
        {suggestion.alternative ? `${suggestion.alternative} option` : 'Suggested option'}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography data-testid={dataTestIds.documentProcedurePage.recommendedCptCode(suggestion.code)}>
          <strong>
            {suggestion.code}
            {suggestion.modifiers?.length ? `-${suggestion.modifiers.join('-')}` : ''}
          </strong>
          {(suggestion.units ?? 1) !== 1 ? ` × ${suggestion.units}` : ''} &ndash; {entries[0].display}
        </Typography>
        {!isReadOnly && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={suggestion.justification}>
              <IconButton size="small" aria-label={`When to use CPT code ${suggestion.code}`}>
                <InfoOutlined sx={{ fontSize: '24px' }} />
              </IconButton>
            </Tooltip>
            {allAdded ? (
              <IconButton size="small" disabled aria-label={`CPT code ${suggestion.code} already added`}>
                <CheckCircle sx={{ fontSize: '24px', color: 'success.main' }} />
              </IconButton>
            ) : (
              <Tooltip title={isLoadingDescriptions ? 'Loading the description…' : 'Add CPT code'}>
                <IconButton
                  size="small"
                  disabled={isLoadingDescriptions}
                  aria-label={`Add CPT code ${suggestion.code}`}
                  onClick={() => onAddCodes(entries)}
                  data-testid={dataTestIds.documentProcedurePage.cptCodeQuickAddButton(suggestion.code)}
                >
                  <AddCircleOutline sx={{ fontSize: '26px', color: 'primary.main' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
      {entries.slice(1).map((entry) => (
        <Typography key={entry.code} sx={{ fontSize: '16px', color: 'text.primary' }}>
          + {entry.code} × {entry.billableUnits ?? 1} — {entry.display}
        </Typography>
      ))}
      <Typography sx={{ fontSize: '15px', color: 'text.secondary' }}>{suggestion.justification}</Typography>
    </Box>
  );
};
