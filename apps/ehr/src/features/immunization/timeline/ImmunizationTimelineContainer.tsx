import { Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement } from 'react';
import { useGetImmunizationForecast } from 'src/features/visits/in-person/hooks/useImmunization';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { useClearImmunizationMark, useSaveImmunizationMark } from '../hooks/useImmunizationForecast';
import { ImmunizationTimeline } from './ImmunizationTimeline';

interface ImmunizationTimelineContainerProps {
  patientId: string | undefined;
  /** A signed visit: the timeline shows no Mark or Clear controls. */
  readOnly?: boolean;
  /** The visit the timeline is read in: its day is the assessment date. */
  encounterId?: string;
  /** Assessment date without a visit, ISO yyyy-mm-dd; today in the browser's zone when absent. */
  asOf?: string;
}

/** Flowsheets › Immunizations: the forecast for the patient, with the per-vaccine marks wired to their zambdas. */
export const ImmunizationTimelineContainer = ({
  patientId,
  readOnly = false,
  encounterId,
  asOf,
}: ImmunizationTimelineContainerProps): ReactElement => {
  const { data, isLoading, error } = useGetImmunizationForecast({
    patientId,
    ...(encounterId ? { encounterId } : { asOf: asOf ?? DateTime.now().toISODate()! }),
  });
  const saveMark = useSaveImmunizationMark();
  const clearMark = useClearImmunizationMark();

  if (!patientId) return <Typography>No data available</Typography>;
  if (isLoading) return <Loader />;
  if (error) return <Typography color="error">Error: {error.message}</Typography>;
  if (!data) return <Typography>No data available</Typography>;

  const mutationError = saveMark.error ?? clearMark.error;
  return (
    <Stack spacing={1}>
      {mutationError && <Typography color="error">Error: {mutationError.message}</Typography>}
      <ImmunizationTimeline
        forecast={data.forecast}
        immunizations={data.immunizations}
        marks={data.marks}
        dob={data.dob}
        readOnly={readOnly}
        busy={saveMark.isPending || clearMark.isPending}
        onMark={(group, mark, note) => saveMark.mutate({ patientId, vaccineGroup: group, mark, note })}
        onClear={(markId) => clearMark.mutate({ markId })}
      />
    </Stack>
  );
};
