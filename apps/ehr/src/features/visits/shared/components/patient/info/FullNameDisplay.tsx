import { Skeleton, Typography } from '@mui/material';
import { Variant } from '@mui/material/styles/createTypography';
import { Patient } from 'fhir/r4b';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getFormattedPatientFullName } from 'utils/lib/fhir/patient';

type Props = {
  patient: Patient | undefined;
  loading?: boolean;
  variant?: Variant;
};

export const FullNameDisplay: FC<Props> = ({ patient, loading, variant = 'h3' }) => {
  const formattedPatientFullName = patient ? getFormattedPatientFullName(patient) : undefined;

  return (
    <Typography variant={variant} color="primary.dark" data-testid={dataTestIds.patientHeader.patientName}>
      {loading ? <Skeleton width={300} /> : formattedPatientFullName ?? null}
    </Typography>
  );
};
