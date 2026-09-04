import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeCandidate } from 'utils';
import { stripCodePrefix } from './CodeSuggestionRow';

interface CodeCandidateListProps {
  label: string;
  summary: string;
  candidates: CodeCandidate[];
}

export const CodeCandidateList: FC<CodeCandidateListProps> = ({ label, summary, candidates }) => (
  <Box>
    <Typography variant="body2" data-testid={dataTestIds.documentProcedurePage.openCandidatesLine}>
      {summary}
    </Typography>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>
      {label}
    </Typography>
    <Box
      component="ul"
      sx={{ margin: 0, paddingLeft: '20px' }}
      data-testid={dataTestIds.documentProcedurePage.openCandidatesList}
    >
      {candidates.map((candidate) => (
        <li key={candidate.code} data-testid={dataTestIds.documentProcedurePage.openCandidate(candidate.code)}>
          <Typography variant="body2">
            <strong>{candidate.code}</strong> &ndash; {stripCodePrefix(candidate.display, candidate.code)}
          </Typography>
        </li>
      ))}
    </Box>
  </Box>
);
