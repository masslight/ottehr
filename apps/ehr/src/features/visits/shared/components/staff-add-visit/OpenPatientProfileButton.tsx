import { OpenInNew } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { FC } from 'react';
import { useHref } from 'react-router-dom';

// Opens the patient's profile in a new tab, so the form being filled in is not lost.
export const OpenPatientProfileButton: FC<{ patientId: string | undefined }> = ({ patientId }) => {
  const href = useHref(`/patient/${patientId ?? ''}`);
  if (!patientId) return null;
  return (
    <Tooltip title="Open patient profile in a new tab">
      <IconButton
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        aria-label="Open patient profile in a new tab"
        sx={{ marginTop: 0.5 }}
      >
        <OpenInNew fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};
