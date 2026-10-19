import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeCandidate } from 'utils/lib/procedure-coding/model.types';
import { stripCodePrefix } from './CodeSuggestionRow';

interface CodeCandidateListProps {
  label: string;
  summary: string;
  candidates: CodeCandidate[];
}

export const CodeCandidateList: FC<CodeCandidateListProps> = ({ label, summary, candidates }) => (
  <Box>
    <Typography sx={{ fontSize: '16px' }} data-testid={dataTestIds.documentProcedurePage.openCandidatesLine}>
      {summary}
    </Typography>
    <Typography sx={{ fontSize: '15px', fontWeight: 700 }}>{label}</Typography>
    <Box
      component="ul"
      sx={{ margin: 0, paddingLeft: '20px' }}
      data-testid={dataTestIds.documentProcedurePage.openCandidatesList}
    >
      {candidates.map((candidate) => (
        <li key={candidate.code} data-testid={dataTestIds.documentProcedurePage.openCandidate(candidate.code)}>
          <Typography sx={{ fontSize: '16px' }}>
            <strong>{candidate.code}</strong> &ndash; {stripCodePrefix(candidate.display, candidate.code)}
          </Typography>
        </li>
      ))}
    </Box>
  </Box>
);
