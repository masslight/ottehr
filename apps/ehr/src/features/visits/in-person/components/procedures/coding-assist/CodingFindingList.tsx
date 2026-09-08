import { Box, Typography } from '@mui/material';
import { FC, ReactElement } from 'react';
import { EvaluationResult, EvidenceSource, Finding, FindingEvidence, FindingScopeKind } from 'utils';

export function actionableFindings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.level !== 'bestPractice');
}

export function collectPayerNotes(evaluation: EvaluationResult | undefined): string[] {
  const notes = [
    ...(evaluation?.payerNotes ?? []),
    ...(evaluation?.findings ?? []).map((finding) => finding.payerNote).filter((note): note is string => note != null),
  ];
  return notes.filter((note, index) => notes.indexOf(note) === index);
}

export const PayerNoteList: FC<{ notes: string[] }> = ({ notes }) =>
  notes.length > 0 ? (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {notes.map((note) => (
        <Typography key={note} variant="caption" color="text.secondary">
          {note}
        </Typography>
      ))}
    </Box>
  ) : null;

function findingCitation(evidence: FindingEvidence): ReactElement | null {
  switch (evidence.source) {
    case EvidenceSource.Text:
      return (
        <Typography component="span" variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          {' '}
          (&ldquo;{evidence.sourceText}&rdquo;)
        </Typography>
      );
    case EvidenceSource.Field:
    case EvidenceSource.Absence:
      return null;
    default: {
      const exhaustiveCheck: never = evidence;
      return exhaustiveCheck;
    }
  }
}

const findingLine = (finding: Finding, key: number | string): ReactElement => (
  <Typography key={key} variant="body2">
    {finding.message}
    {finding.level === 'contradiction' && findingCitation(finding.evidence)}
  </Typography>
);

interface CodingFindingListProps {
  findings: Finding[];
  dataTestId?: string;
}

export const CodingFindingList: FC<CodingFindingListProps> = ({ findings, dataTestId }) => {
  const actionable = actionableFindings(findings);
  const entryLevel = actionable.filter((finding) => finding.scope.kind === FindingScopeKind.Entry);
  const codes = [
    ...new Set(
      actionable.flatMap((finding) => (finding.scope.kind === FindingScopeKind.Code ? [finding.scope.cptCode] : []))
    ),
  ];
  const bestPractices = findings.filter((finding) => finding.level === 'bestPractice');

  if (actionable.length === 0 && bestPractices.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, paddingTop: '4px' }} data-testid={dataTestId}>
      {entryLevel.map((finding, index) => findingLine(finding, `entry-${index}`))}
      {codes.map((code) => (
        <Box key={code}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {code}
          </Typography>
          {actionable
            .filter((finding) => finding.scope.kind === FindingScopeKind.Code && finding.scope.cptCode === code)
            .map((finding, index) => findingLine(finding, index))}
        </Box>
      ))}
      {bestPractices.map((finding, index) => (
        <Typography key={`best-practice-${index}`} variant="body2" color="text.secondary">
          {finding.message}
        </Typography>
      ))}
    </Box>
  );
};
