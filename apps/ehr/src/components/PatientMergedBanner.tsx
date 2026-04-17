import { Alert, AlertTitle, Link as MuiLink } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface PatientMergedBannerProps {
  patient: Patient | undefined;
}

/**
 * Displays an info banner when viewing a patient record that has been merged
 * into another patient (active=false, link.type='replaced-by').
 */
export const PatientMergedBanner: FC<PatientMergedBannerProps> = ({ patient }) => {
  if (!patient) return null;

  const replacedByLink = patient.link?.find((l) => l.type === 'replaced-by');
  if (patient.active !== false || !replacedByLink) return null;

  const targetRef = replacedByLink.other?.reference; // e.g. "Patient/<id>"
  const targetId = targetRef?.replace('Patient/', '');

  return (
    <Alert severity="info" variant="filled" sx={{ alignItems: 'center' }}>
      <AlertTitle sx={{ mb: 0 }}>
        This patient record has been merged.{' '}
        {targetId ? (
          <>
            All data has been transferred to{' '}
            <MuiLink
              component={RouterLink}
              to={`/patient/${targetId}`}
              sx={{ color: 'inherit', fontWeight: 700, textDecorationColor: 'inherit' }}
            >
              the surviving patient record
            </MuiLink>
            .
          </>
        ) : (
          'All data has been transferred to the surviving patient record.'
        )}
      </AlertTitle>
    </Alert>
  );
};
