import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { Box, Skeleton, Tooltip, Typography } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { FC } from 'react';
import { getPatientAddress } from 'utils/lib/fhir/patient';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { dataTestIds } from '../../../constants/data-test-ids';

type Props = {
  patient: Patient | undefined;
  loading?: boolean;
};

export const Contacts: FC<Props> = ({ loading, patient }) => {
  const patientNumber = patient?.telecom?.find((obj) => obj.system === 'phone')?.value;
  const contactNumber = patient?.contact?.[0].telecom?.find((obj) => obj?.system === 'phone')?.value;

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {loading ? (
        <Skeleton width={275} variant="text" />
      ) : (
        getPatientAddress(patient?.address).zipStateCityLine && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <PlaceOutlinedIcon fontSize="small" />
            <Typography data-testid={dataTestIds.patientHeader.patientAddress}>
              {getPatientAddress(patient?.address).zipStateCityLine}
            </Typography>
          </Box>
        )
      )}

      {loading ? (
        <Skeleton width={115} />
      ) : (
        <Tooltip title="Patient phone number">
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <PhoneOutlinedIcon fontSize="small" />
            <Typography data-testid={dataTestIds.patientHeader.patientPhoneNumber}>
              {patientNumber ? formatPhoneNumberDisplay(patientNumber) : '-'}
            </Typography>
          </Box>
        </Tooltip>
      )}

      {loading ? (
        <Skeleton width={115} />
      ) : (
        <Tooltip title="Emergency contact">
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <ContactPhoneOutlinedIcon fontSize="small" />
            <Typography data-testid={dataTestIds.patientHeader.emergencyContact}>
              {contactNumber ? formatPhoneNumberDisplay(contactNumber) : '-'}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

export default Contacts;
