import { AddCircleOutline, CheckCircle, InfoOutlined } from '@mui/icons-material';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeSuggestion, CPTCodeDTO } from 'utils';

export const stripCodePrefix = (display: string, code: string): string =>
  display.startsWith(code) ? display.slice(code.length).replace(/^\s*[—–-]\s*/, '') : display;

interface CodeSuggestionRowProps {
  suggestion: CodeSuggestion;
  isReadOnly: boolean;
  selectedCodes: CPTCodeDTO[];
  onAddCodes: (entries: CPTCodeDTO[]) => void;
}

export const CodeSuggestionRow: FC<CodeSuggestionRowProps> = ({
  suggestion,
  isReadOnly,
  selectedCodes,
  onAddCodes,
}) => {
  const entries: CPTCodeDTO[] = [
    { code: suggestion.code, display: stripCodePrefix(suggestion.display, suggestion.code) },
    ...(suggestion.addOns ?? []).map((addOn) => ({
      code: addOn.code,
      display: stripCodePrefix(addOn.display, addOn.code),
      billableUnits: addOn.units,
    })),
  ];

  const allAdded = entries.every((entry) =>
    selectedCodes.some(
      (selected) => selected.code === entry.code && (selected.billableUnits ?? 1) === (entry.billableUnits ?? 1)
    )
  );

  return (
    <Box data-testid={dataTestIds.documentProcedurePage.bestMatchCptCode}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.dark' }}>
        Best match
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography data-testid={dataTestIds.documentProcedurePage.recommendedCptCode(suggestion.code)}>
          <strong>{suggestion.code}</strong> &ndash; {entries[0].display}
        </Typography>
        {!isReadOnly && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={suggestion.justification}>
              <IconButton size="small" aria-label={`When to use CPT code ${suggestion.code}`}>
                <InfoOutlined sx={{ fontSize: '17px' }} />
              </IconButton>
            </Tooltip>
            {allAdded ? (
              <IconButton size="small" disabled aria-label={`CPT code ${suggestion.code} already added`}>
                <CheckCircle sx={{ fontSize: '17px', color: 'success.main' }} />
              </IconButton>
            ) : (
              <Tooltip title="Add CPT code">
                <IconButton
                  size="small"
                  aria-label={`Add CPT code ${suggestion.code}`}
                  onClick={() => onAddCodes(entries)}
                  data-testid={dataTestIds.documentProcedurePage.cptCodeQuickAddButton(suggestion.code)}
                >
                  <AddCircleOutline sx={{ fontSize: '17px' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {suggestion.justification}
      </Typography>
    </Box>
  );
};
