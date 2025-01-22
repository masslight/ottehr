import { Skeleton, Typography } from '@mui/material';
import { Variant } from '@mui/material/styles/createTypography';
import { FC, useMemo } from 'react';
import { getFirstName, getLastName, getMiddleName, getNickname } from 'utils/lib/fhir/patient';
import { formatPatientName } from '../../../helpers/formatPatientName';
import { useGetPatient } from '../../../hooks/useGetPatient';
import { dataTestIds } from '../../../constants/data-test-ids';

type Props = {
  id?: string;
  variant?: Variant;
};

export const FullNameDisplay: FC<Props> = ({ id, variant = 'h3' }) => {
  const { loading, patient } = useGetPatient(id);
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
