// The read-only body of a disposition, shared by every surface that displays one.
//
// EXTRACTED, NOT COPIED. A disposition is not just a type and a note: depending on the type it also
// carries the specialty transferred to, the lab services ordered on discharge, the virus tests within
// them, the reason for transfer, a nothing-to-eat-or-drink instruction, and a refusal-of-EMS-transport
// attestation. Two surfaces rendering "the disposition" from the DTO by hand agree only until one of
// them gains a field, and the one that lags shows a discharge plan missing part of itself.
//
// Every value here goes through the same label maps the Plan tab's editor writes them with —
// `mapDispositionTypeToLabel`, `followUpInOptions`, `dispositionCheckboxOptions`. The stored values are
// codes ("pcp-no-type", followUpIn: 0), so printing them raw shows a provider the database's words
// rather than their own.

import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import {
  dispositionCheckboxOptions,
  getSpecialtyTransferDisplay,
  mapDispositionTypeToLabel,
} from 'utils/lib/fhir/disposition';
import {
  DispositionDTO,
  DispositionType,
  followUpInOptions,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
  REFUSAL_OF_EMS_TRANSPORT_LABEL,
} from 'utils/lib/types/api/chart-data/chart-data.types';

/**
 * The label a provider chose, for a stored type code.
 *
 * Falls back to the raw code rather than rendering nothing: a disposition saved under a legacy or
 * unknown type is bad data, but silently blanking it hides that the field was set at all.
 */
export function dispositionTypeLabel(type: DispositionType | undefined): string | undefined {
  if (!type) return undefined;
  return mapDispositionTypeToLabel[type] ?? type;
}

/** "Follow-up visit in 2 weeks", or whatever `0` means in the option list ("as needed"). */
export function followUpInLabel(followUpIn: number | undefined): string | undefined {
  if (typeof followUpIn !== 'number') return undefined;
  const label = followUpInOptions.find((option) => option.value === followUpIn)?.label;
  if (!label) return undefined;
  // Zero is not a duration, so it reads on its own without the "in".
  return followUpIn === 0 ? `Follow-up visit ${label}` : `Follow-up visit in ${label}`;
}

/**
 * Everything a disposition states, minus its type — the type is normally the heading, so the caller
 * decides where it goes.
 */
export const DispositionSummary: FC<{ disposition: DispositionDTO | undefined }> = ({ disposition }) => {
  if (!disposition) return null;
  const followUp = followUpInLabel(disposition.followUpIn);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {disposition.specialty && disposition.specialty.length > 0 && (
        <Typography>{getSpecialtyTransferDisplay(disposition.specialty, disposition.specialtyOther)}</Typography>
      )}
      {disposition.note && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{disposition.note}</Typography>}
      {disposition[NOTHING_TO_EAT_OR_DRINK_FIELD] && <Typography>{NOTHING_TO_EAT_OR_DRINK_LABEL}</Typography>}
      {disposition[REFUSAL_OF_EMS_TRANSPORT_FIELD] && <Typography>{REFUSAL_OF_EMS_TRANSPORT_LABEL}</Typography>}
      {disposition.labService && disposition.labService.length > 0 && (
        <Typography>Lab Services: {disposition.labService.join(', ')}</Typography>
      )}
      {disposition.virusTest && disposition.virusTest.length > 0 && (
        <Typography>Virus Tests: {disposition.virusTest.join(', ')}</Typography>
      )}
      {followUp && <Typography>{followUp}</Typography>}
      {disposition.reason && disposition.reason.length > 0 && (
        <Typography>Reason for transfer: {disposition.reason}</Typography>
      )}
    </Box>
  );
};

/** The optional subspecialty follow-up checkboxes, which sit under their own heading. */
export const SubspecialtyFollowUpList: FC<{ disposition: DispositionDTO | undefined }> = ({ disposition }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    {disposition?.followUp?.map((followUp) => {
      const option = dispositionCheckboxOptions.find((candidate) => candidate.name === followUp.type);
      if (!option) return null;
      const note = followUp.type === 'other' && followUp.note ? `: ${followUp.note}` : '';
      return <Typography key={followUp.type}>{`${option.label}${note}`}</Typography>;
    })}
  </Box>
);
