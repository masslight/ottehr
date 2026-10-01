import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CodeOutcome, CodeOutcomeKind, EvaluationResult } from 'utils/lib/procedure-coding/model.types';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
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
  onRetrySuggestions?: () => void;
}

export const CodingAssistPanel: FC<CodingAssistPanelProps> = ({
  evaluation,
  isEvaluating,
  rulesVintage,
  procedureTypeSelected,
  isReadOnly,
  selectedCodes,
  onAddCodes,
  onRetrySuggestions,
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
      case CodeOutcomeKind.Suggestions:
        return outcome.suggestions
          .filter((suggestion) => !suggestion.requiresCode)
          .map((suggestion, index) => (
            <CodeSuggestionRow
              key={index}
              suggestion={{
                ...suggestion,
                addOns: outcome.suggestions
                  .filter(
                    (line) =>
                      line.requiresCode === suggestion.code &&
                      outcome.suggestions.find((base) => base.code === suggestion.code) === suggestion
                  )
                  .map((line) => ({
                    code: line.code,
                    display: line.display,
                    units: line.units ?? 1,
                    justification: line.justification,
                  })),
              }}
              source={evaluation?.source}
              isReadOnly={isReadOnly}
              selectedCodes={selectedCodes}
              onAddCodes={onAddCodes}
            />
          ));
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
          <>
            <Typography
              sx={{ fontSize: '16px' }}
              color="text.secondary"
              data-testid={dataTestIds.documentProcedurePage.codingAssistNotAssessed}
            >
              {outcome.reason}
            </Typography>
            {evaluation?.source === 'ai' && onRetrySuggestions && (
              <Button onClick={onRetrySuggestions}>Try again</Button>
            )}
          </>
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
          <Typography sx={{ fontSize: '16px', color: 'text.primary' }}>Checking your documentation…</Typography>
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
        <Typography sx={{ fontWeight: 700, fontSize: '17px' }}>
          {evaluation?.source === 'ai' ? 'Possible CPT codes — AI suggestions' : 'CPT code — from your documentation'}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid={dataTestIds.documentProcedurePage.codingRulesVintage}
        >
          {evaluation?.source === 'ai' ? 'Clinician review required' : `Checks current as of ${rulesVintage}`}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-live="polite">
        {body()}
      </Box>
    </Box>
  );
};
