import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';

export type SettledPlanStepResult = { status: 'done' | 'skipped' | 'error'; label: string; message?: string };

// Same glyphs as the running plan card's status icons (AssistantColumn.planStepStatusIcon).
const statusIcon = (status: SettledPlanStepResult['status']): string =>
  status === 'done' ? '✓' : status === 'skipped' ? '⏭' : '✗';

// The persisted form of a completed plan, rendered inside an assistant thread bubble: the
// "Plan complete: …" summary as a header, then the per-step outcomes in the same visual
// language as the live running card (monospace rows, ✓/⏭/✗ icons) — minus the Cancel button
// and the ▶ current-step marker, since nothing is running anymore.
export function SettledPlanCard({
  summary,
  results,
}: {
  summary: string;
  results: SettledPlanStepResult[];
}): ReactElement {
  return (
    <Box>
      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
        {summary}
      </Typography>
      <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
        {results.map((r, i) => (
          <Box key={i}>
            <Typography
              variant="body2"
              sx={{ display: 'block', color: 'text.secondary', fontFamily: 'monospace', lineHeight: 1.5 }}
            >
              {statusIcon(r.status)} {i + 1}. {r.label}
            </Typography>
            {r.message && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', pl: 3 }}>
                {r.message}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
