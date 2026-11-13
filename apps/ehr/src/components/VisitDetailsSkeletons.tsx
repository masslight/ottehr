import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { ReactElement } from 'react';

/**
 * Placeholders for the Visit Details page. Each one stands in for a block whose content arrives
 * from several requests, and is sized like the block usually ends up, so the page keeps its shape
 * while those requests are in flight and the content can be swapped in once, at full size.
 */

function SkeletonRows({ count }: { count: number }): ReactElement {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, py: 1 }}>
          <Skeleton width="30%" />
          <Skeleton width="45%" />
        </Box>
      ))}
    </>
  );
}

function SkeletonCard({ rows, marginTop }: { rows: number; marginTop?: number }): ReactElement {
  return (
    <Paper sx={{ padding: 3, marginTop }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        <Skeleton width="55%" />
      </Typography>
      <SkeletonRows count={rows} />
    </Paper>
  );
}

/** The payments / tracking-board-note column of "About this visit". */
export function VisitSideColumnSkeleton(): ReactElement {
  return (
    <Box aria-busy="true" aria-label="Loading payments and notes">
      <SkeletonCard rows={6} marginTop={2} />
      <SkeletonCard rows={2} marginTop={2} />
    </Box>
  );
}

const PATIENT_RECORD_COLUMNS = [
  [9, 7, 7, 1],
  [2, 10, 8, 2],
];

/** The two-column patient record form under "About this patient". */
export function PatientRecordSkeleton(): ReactElement {
  return (
    <Box aria-busy="true" aria-label="Loading patient record" sx={{ display: 'flex', gap: 3, marginBottom: 2 }}>
      {PATIENT_RECORD_COLUMNS.map((cards, columnIndex) => (
        <Box key={columnIndex} sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {cards.map((rows, cardIndex) => (
            <SkeletonCard key={cardIndex} rows={rows} />
          ))}
        </Box>
      ))}
    </Box>
  );
}
