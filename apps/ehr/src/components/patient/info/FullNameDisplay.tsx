import { Skeleton, Typography } from '@mui/material';
import { Variant } from '@mui/material/styles/createTypography';
import { Patient } from 'fhir/r4b';
import { FC, useMemo } from 'react';
import { getFirstName, getLastName, getMiddleName, getNickname } from 'utils/lib/fhir/patient';
import { dataTestIds } from '../../../constants/data-test-ids';
import { formatPatientName } from '../../../helpers/formatPatientName';

type Props = {
  patient: Patient | undefined;
  loading?: boolean;
  variant?: Variant;
};

export const FullNameDisplay: FC<Props> = ({ patient, loading, variant = 'h3' }) => {
  const { firstName, lastName, middleName, nickname } = useMemo(() => {
    if (!patient) return {};
    return {
      firstName: getFirstName(patient),
      lastName: getLastName(patient),
      middleName: getMiddleName(patient),
      nickname: getNickname(patient),
    };
  }, [patient]);

  const formattedPatientFullName = useMemo(() => {
    return lastName && firstName && formatPatientName({ lastName, firstName, middleName, nickname });
  }, [firstName, lastName, middleName, nickname]);

  return (
    <Typography variant={variant} color="primary.dark" data-testid={dataTestIds.patientHeader.patientName}>
      {loading ? <Skeleton width={300} /> : formattedPatientFullName}
    </Typography>
  );
};
