import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeAssessmentKind, codesWithAssessment, EvaluationResult, FindingScopeKind } from 'utils';
import { actionableFindings, CodingFindingList, collectPayerNotes, PayerNoteList } from './CodingFindingList';

interface DocumentationCheckProps {
  evaluation: EvaluationResult | undefined;
  suggestionVisible: boolean;
}

export const DocumentationCheck: FC<DocumentationCheckProps> = ({ evaluation, suggestionVisible }) => {
  const allFindings = evaluation?.findings ?? [];
  const findings = suggestionVisible
    ? allFindings.filter(
        (finding) =>
          finding.scope.kind !== FindingScopeKind.Entry ||
          (finding.level !== 'determines' && finding.level !== 'required')
      )
    : allFindings;

  // Best-practice reminders ("record the suture count", …) belong to the suggested code and are
  // already printed in the suggestion panel above, which is on screen from the moment a code is
  // suggested. Repeating them here put the same three lines on the page twice.
  const actionable = actionableFindings(findings);
  const payerNotes = collectPayerNotes(evaluation);
  const supportedCodes = evaluation == null ? [] : codesWithAssessment(evaluation, CodeAssessmentKind.Supported);
  const notAssessedCodes = evaluation == null ? [] : codesWithAssessment(evaluation, CodeAssessmentKind.NotAssessed);
  const checkVisible = actionable.length > 0;
  const positiveStateVisible = !checkVisible && supportedCodes.length > 0;
  const notAssessedLineVisible = notAssessedCodes.length > 0;

  return (
    <>
      {checkVisible && (
        // Same box shape as the suggestion panel above it: a Container would add its own max width
        // and gutters, so the two coloured plates would not line up.
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            background: '#FFF3E0',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          <Typography sx={{ fontSize: '17px', fontWeight: 700 }}>Documentation check</Typography>
          <CodingFindingList
            findings={actionable}
            dataTestId={dataTestIds.documentProcedurePage.codingDefenseFindings}
          />
          <PayerNoteList notes={payerNotes} />
        </Box>
      )}
      {positiveStateVisible && (
        <Box data-testid={dataTestIds.documentProcedurePage.codingDefenseSupported}>
          <Typography sx={{ fontSize: '16px', fontWeight: 600, color: 'success.dark' }}>
            Documentation supports {supportedCodes.join(', ')}
          </Typography>
          <PayerNoteList notes={payerNotes} />
        </Box>
      )}
      {notAssessedLineVisible && (
        <Typography
          sx={{ fontSize: '16px' }}
          color="text.secondary"
          data-testid={dataTestIds.documentProcedurePage.codingDefenseNotAssessed}
        >
          {notAssessedCodes.join(', ')} &mdash; not assessed by documentation checks
        </Typography>
      )}
    </>
  );
};
