// Lab RESULTS in the easy-chart note. The "Labs ordered" section covers orders; this covers what
// came back (chartData.inHouseLabResults / externalLabResults, fetched via
// progressNoteChartDataRequestedFields). Mirrors the Review & Sign LabResultsReviewContainer's
// rules in the easy-chart's compact visual language: result name links to the presigned PDF,
// abnormal/inconclusive flags, external reflex results indented under their parent, and a
// "Lab Results Pending" line while results are outstanding.
import CheckIcon from '@mui/icons-material/Check';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Link, Stack, Typography } from '@mui/material';
import { Fragment } from 'react';
import {
  EncounterExternalLabResult,
  EncounterInHouseLabResult,
  ExternalLabOrderResult,
  InHouseLabResult,
  NonNormalResult,
} from 'utils/lib/types/api/lab';

// Whether there's anything worth a section — same gating Review & Sign uses (results received OR
// results pending, per lab kind).
export function hasLabResultsToShow(
  inHouse: EncounterInHouseLabResult | undefined,
  external: EncounterExternalLabResult | undefined
): boolean {
  const has = (r?: { labOrderResults: unknown[]; resultsPending: string[] | undefined }): boolean =>
    !!r && ((r.labOrderResults?.length ?? 0) > 0 || (r.resultsPending?.length ?? 0) > 0);
  return has(inHouse) || has(external);
}

const flagBadge = (icon: JSX.Element, text: string, textColor: string): JSX.Element => (
  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', ml: 1 }}>
    {icon}
    <Typography component="span" variant="caption" sx={{ ml: 0.5, color: textColor }}>
      {text}
    </Typography>
  </Box>
);

// Same rules as Review & Sign's checkForAbnormalResultFlag: each contained flag renders
// (abnormal → orange, inconclusive → grey, neutral → nothing). With no flag data at all,
// in-house reads as normal, but external deliberately shows NOTHING — normalcy can't be
// assumed at a high level for external labs.
function ResultFlag({
  result,
  isExternal,
}: {
  result: ExternalLabOrderResult | InHouseLabResult;
  isExternal: boolean;
}): JSX.Element | null {
  const flags = result.nonNormalResultContained;
  if (!flags) {
    return isExternal
      ? null
      : flagBadge(<CheckIcon color="success" sx={{ fontSize: 16 }} />, 'Normal Result', 'success.main');
  }
  return (
    <>
      {flags.map((flag, i) => {
        switch (flag) {
          case NonNormalResult.Abnormal:
            return (
              <Fragment key={i}>
                {flagBadge(
                  <WarningAmberOutlinedIcon color="warning" sx={{ fontSize: 16 }} />,
                  'Abnormal Result',
                  'warning.main'
                )}
              </Fragment>
            );
          case NonNormalResult.Inconclusive:
            return (
              <Fragment key={i}>
                {flagBadge(
                  <HelpOutlineIcon color="disabled" sx={{ fontSize: 16 }} />,
                  'Inconclusive Result',
                  'text.disabled'
                )}
              </Fragment>
            );
          case NonNormalResult.Neutral:
            return null;
        }
      })}
    </>
  );
}

export function LabResultsList({
  inHouse,
  external,
}: {
  inHouse?: EncounterInHouseLabResult;
  external?: EncounterExternalLabResult;
}): JSX.Element {
  const groups: {
    key: string;
    label: string;
    isExternal: boolean;
    results: (ExternalLabOrderResult | InHouseLabResult)[];
    pending: boolean;
  }[] = [
    {
      key: 'in-house',
      label: 'In-house',
      isExternal: false,
      results: inHouse?.labOrderResults ?? [],
      pending: (inHouse?.resultsPending?.length ?? 0) > 0,
    },
    {
      key: 'external',
      label: 'External',
      isExternal: true,
      results: external?.labOrderResults ?? [],
      pending: (external?.resultsPending?.length ?? 0) > 0,
    },
  ].filter((g) => g.results.length > 0 || g.pending);

  return (
    <Stack spacing={1}>
      {groups.map((g) => (
        <Box key={g.key}>
          <Typography variant="caption" color="text.secondary">
            {g.label}
          </Typography>
          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
            {g.results.map((res, idx) => (
              <Box key={`${g.key}-${idx}`}>
                <Typography variant="body2">
                  •{' '}
                  <Link href={res.url} target="_blank" rel="noopener noreferrer">
                    {res.name}
                  </Link>
                  <ResultFlag result={res} isExternal={g.isExternal} />
                </Typography>
                {/* Reflex results: external only, indented under their parent (mirrors R&S). */}
                {g.isExternal &&
                  'reflexResults' in res &&
                  res.reflexResults?.map((reflex, reflexIdx) => (
                    <Typography key={`${g.key}-${idx}-${reflexIdx}`} variant="body2" sx={{ ml: 2.5 }}>
                      <Link href={reflex.url} target="_blank" rel="noopener noreferrer">
                        + {reflex.name}
                      </Link>
                    </Typography>
                  ))}
              </Box>
            ))}
            {g.pending && (
              <Typography variant="body2" color="text.secondary">
                Lab Results Pending
              </Typography>
            )}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
