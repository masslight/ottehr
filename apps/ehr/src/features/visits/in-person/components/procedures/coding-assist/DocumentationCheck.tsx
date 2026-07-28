import { Box, Container, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeAssessmentKind, codesWithAssessment, EvaluationResult } from 'utils';
import { actionableFindings, CodingFindingList, collectPayerNotes, PayerNoteList } from './CodingFindingList';

interface DocumentationCheckProps {
  evaluation: EvaluationResult | undefined;
  suggestionVisible: boolean;
}

export const DocumentationCheck: FC<DocumentationCheckProps> = ({ evaluation, suggestionVisible }) => {
  const findings = evaluation?.findings ?? [];
  const actionable = actionableFindings(findings);
  const reminders = findings.filter((finding) => finding.level === 'bestPractice');
  const payerNotes = collectPayerNotes(evaluation);
  const supportedCodes = evaluation == null ? [] : codesWithAssessment(evaluation, CodeAssessmentKind.Supported);
  const notAssessedCodes = evaluation == null ? [] : codesWithAssessment(evaluation, CodeAssessmentKind.NotAssessed);
  const checkVisible = actionable.length > 0;
  const positiveStateVisible = !checkVisible && supportedCodes.length > 0;
  const notAssessedLineVisible =
    notAssessedCodes.length > 0 && (checkVisible || positiveStateVisible || suggestionVisible);

  return (
    <>
      {checkVisible && (
        <Container
          style={{
            background: '#FFF3E0',
            borderRadius: '8px',
            padding: '4px 8px 4px 8px',
          }}
        >
          <Container style={{ display: 'flex', alignItems: 'center', padding: 0 }}>
            <Typography variant="body1" style={{ fontWeight: 700 }}>
              Documentation check
            </Typography>
          </Container>
          <CodingFindingList findings={findings} dataTestId={dataTestIds.documentProcedurePage.codingDefenseFindings} />
          <PayerNoteList notes={payerNotes} />
        </Container>
      )}
      {positiveStateVisible && (
        <Box data-testid={dataTestIds.documentProcedurePage.codingDefenseSupported}>
          <Typography variant="body2" sx={{ color: 'success.main' }}>
            Documentation supports {supportedCodes.join(', ')}
          </Typography>
          <CodingFindingList
            findings={reminders}
            dataTestId={dataTestIds.documentProcedurePage.codingDefenseFindings}
          />
          <PayerNoteList notes={payerNotes} />
        </Box>
      )}
      {notAssessedLineVisible && (
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid={dataTestIds.documentProcedurePage.codingDefenseNotAssessed}
        >
          {notAssessedCodes.join(', ')} &mdash; not assessed by documentation checks
        </Typography>
      )}
    </>
  );
};
