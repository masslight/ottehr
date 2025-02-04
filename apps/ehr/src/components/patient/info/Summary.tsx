import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import { capitalize, Box, Skeleton, Typography } from '@mui/material';
import { FC } from 'react';
import { PATIENT_INDIVIDUAL_PRONOUNS_URL } from 'utils/lib/types';
import { getExtensionValue } from '../../../features/css-module/parser';
import { formatDateUsingSlashes } from '../../../helpers/formatDateTime';
import { calculatePatientAge } from 'utils';
import { useGetPatient } from '../../../hooks/useGetPatient';
import { dataTestIds } from '../../../constants/data-test-ids';

type Props = {
  id?: string;
};

export const Summary: FC<Props> = ({ id }) => {
  const { loading, patient } = useGetPatient(id);
  const pronouns = getExtensionValue(patient, PATIENT_INDIVIDUAL_PRONOUNS_URL);

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {loading ? <Skeleton width={86} /> : pronouns && <Typography>{pronouns}</Typography>}

      {loading ? (
        <Skeleton width={36} />
      ) : (
        patient?.gender && (
          <Typography data-testid={dataTestIds.patientHeader.patientBirthSex}>{capitalize(patient?.gender)}</Typography>
        )
      )}

      {loading ? (
        <Skeleton width={131} />
      ) : (
        patient?.birthDate && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <CakeOutlinedIcon fontSize="small" />
            <Typography data-testid={dataTestIds.patientHeader.patientBirthday}>
              {formatDateUsingSlashes(patient?.birthDate)} ({calculatePatientAge(patient?.birthDate)}o)
            </Typography>
          </Box>
        )
      )}
    </Box>
  );
};

export default Summary;
