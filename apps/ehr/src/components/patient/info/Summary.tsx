import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import { Box, capitalize, Skeleton, Typography } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { FC } from 'react';
import { formatDOB } from 'utils';
import { PATIENT_INDIVIDUAL_PRONOUNS_URL } from 'utils/lib/types';
import { dataTestIds } from '../../../constants/data-test-ids';
import { getExtensionValue } from '../../../features/css-module/parser';

type Props = {
  id?: string;
  patient: Patient | undefined;
  loading?: boolean;
};

export const Summary: FC<Props> = ({ patient, loading }) => {
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
              {formatDOB(patient?.birthDate)}
            </Typography>
          </Box>
        )
      )}
    </Box>
  );
};

export default Summary;
