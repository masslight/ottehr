import { Box, CircularProgress, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeOutcome, CodeOutcomeKind, CPTCodeDTO, EvaluationResult } from 'utils';
import { CodeCandidateList } from './CodeCandidateList';
import { CodeSuggestionRow } from './CodeSuggestionRow';
import { CodingFindingList, collectPayerNotes, PayerNoteList } from './CodingFindingList';

interface CodingAssistPanelProps {
  evaluation: EvaluationResult | undefined;
  isEvaluating: boolean;
  rulesVintage: string;
  procedureTypeSelected: boolean;
  isReadOnly: boolean;
  selectedCodes: CPTCodeDTO[];
  onAddCodes: (entries: CPTCodeDTO[]) => void;
}

export const CodingAssistPanel: FC<CodingAssistPanelProps> = ({
  evaluation,
  isEvaluating,
  rulesVintage,
  procedureTypeSelected,
  isReadOnly,
  selectedCodes,
  onAddCodes,
}) => {
  const findings = evaluation?.findings ?? [];
  const payerNotes = collectPayerNotes(evaluation);
  const outcomeHasContent =
    evaluation != null &&
    evaluation.outcome.kind !== CodeOutcomeKind.NoCode &&
    evaluation.outcome.kind !== CodeOutcomeKind.NotApplicable;
  const hasContent = outcomeHasContent || findings.length > 0 || payerNotes.length > 0;

  const outcomeContent = (outcome: CodeOutcome): ReactNode => {
    switch (outcome.kind) {
      case CodeOutcomeKind.Determined:
        return (
          <CodeSuggestionRow
            suggestion={outcome.suggestion}
            isReadOnly={isReadOnly}
            selectedCodes={selectedCodes}
            onAddCodes={onAddCodes}
          />
        );
      case CodeOutcomeKind.DeterminedWithAlternates:
        return (
          <>
            <CodeSuggestionRow
              suggestion={outcome.suggestion}
              isReadOnly={isReadOnly}
              selectedCodes={selectedCodes}
              onAddCodes={onAddCodes}
            />
            <CodeCandidateList
              label="Also possible"
              summary={outcome.alternatesSummary}
              candidates={outcome.alternates}
            />
          </>
        );
      case CodeOutcomeKind.Open:
        return <CodeCandidateList label="Possible codes" summary={outcome.summary} candidates={outcome.candidates} />;
      case CodeOutcomeKind.NotAssessed:
        return (
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid={dataTestIds.documentProcedurePage.codingAssistNotAssessed}
          >
            {outcome.reason}
          </Typography>
        );
      case CodeOutcomeKind.NoCode:
      case CodeOutcomeKind.NotApplicable:
        return null;
      default: {
        const exhaustiveCheck: never = outcome;
        return exhaustiveCheck;
      }
    }
  };

  const body = (): ReactNode => {
    if (!procedureTypeSelected) {
      return <Typography color="secondary.light">Select a procedure type to see recommended CPT codes</Typography>;
    }
    if (isEvaluating) {
      return (
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          data-testid={dataTestIds.documentProcedurePage.codingAssistLoading}
        >
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Checking your documentation…
          </Typography>
        </Box>
      );
    }
    if (!hasContent) {
      return (
        <Typography color="text.secondary" data-testid={dataTestIds.documentProcedurePage.codingAssistEmpty}>
          No suggestions
        </Typography>
      );
    }
    return (
      <>
        {evaluation?.outcome && outcomeContent(evaluation.outcome)}
        <CodingFindingList findings={findings} dataTestId={dataTestIds.documentProcedurePage.codingAssistFindings} />
        <PayerNoteList notes={payerNotes} />
      </>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        background: '#F4F6F8',
        borderRadius: '8px',
        padding: '8px',
      }}
      data-testid={dataTestIds.documentProcedurePage.codingAssistPanel}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '14px' }}>
          CPT code — from your documentation
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid={dataTestIds.documentProcedurePage.codingRulesVintage}
        >
          Checks current as of {rulesVintage}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-live="polite">
        {body()}
      </Box>
    </Box>
  );
};
