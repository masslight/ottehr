import { Button, Typography } from '@mui/material';
import React, { useState } from 'react';
import { GenericToolTip } from '../../../components/GenericToolTip';
import { usePatientNotesCount } from '../hooks/usePatientNotesCount';
import { PatientNotesDialog } from './PatientNotesDialog';

interface PatientNotesButtonProps {
  patientId?: string;
}

const icon = (
  <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 16V2V6.475V6V16ZM4 10H9.525C9.55833 9.63333 9.64167 9.28333 9.775 8.95C9.90833 8.61667 10.075 8.3 10.275 8H4V10ZM4 14H7.925C8.20833 13.6667 8.53333 13.3958 8.9 13.1875C9.26667 12.9792 9.65 12.8083 10.05 12.675C9.98333 12.575 9.925 12.4667 9.875 12.35C9.825 12.2333 9.78333 12.1167 9.75 12H4V14ZM4 6H14V4H4V6ZM2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16C16.55 0 17.0208 0.195833 17.4125 0.5875C17.8042 0.979167 18 1.45 18 2V8.45C17.7667 8.01667 17.4833 7.63333 17.15 7.3C16.8167 6.96667 16.4333 6.69167 16 6.475V2H2V16H7.05C7.03333 16.1 7.02083 16.2 7.0125 16.3C7.00417 16.4 7 16.5 7 16.6V18H2ZM12.225 12.275C11.7417 11.7917 11.5 11.2 11.5 10.5C11.5 9.8 11.7417 9.20833 12.225 8.725C12.7083 8.24167 13.3 8 14 8C14.7 8 15.2917 8.24167 15.775 8.725C16.2583 9.20833 16.5 9.8 16.5 10.5C16.5 11.2 16.2583 11.7917 15.775 12.275C15.2917 12.7583 14.7 13 14 13C13.3 13 12.7083 12.7583 12.225 12.275ZM9 18V16.6C9 16.2 9.10417 15.8292 9.3125 15.4875C9.52083 15.1458 9.81667 14.9 10.2 14.75C10.8 14.5 11.4208 14.3125 12.0625 14.1875C12.7042 14.0625 13.35 14 14 14C14.65 14 15.2958 14.0625 15.9375 14.1875C16.5792 14.3125 17.2 14.5 17.8 14.75C18.1833 14.9 18.4792 15.1458 18.6875 15.4875C18.8958 15.8292 19 16.2 19 16.6V18H9Z"
      fill="#2169F5"
    />
  </svg>
);

export const PatientNotesButton: React.FC<PatientNotesButtonProps> = ({ patientId }) => {
  const [open, setOpen] = useState(false);
  const { data: count } = usePatientNotesCount(patientId);

  if (!patientId) return null;

  return (
    <>
      <GenericToolTip
        title="Patient Notes"
        customWidth="none"
        placement="top"
        leaveDelay={100}
        slotProps={{
          tooltip: {
            sx: {
              maxWidth: 150,
              backgroundColor: '#F9FAFB',
              color: '#000000',
              border: '1px solid #dadde9',
            },
          },
          popper: {
            modifiers: [{ name: 'offset', options: { offset: [0, -14] } }],
          },
        }}
      >
        <Button
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0.5,
            minWidth: 'auto',
          }}
        >
          {icon}
          <Typography color="primary.dark">({count ?? 0})</Typography>
        </Button>
      </GenericToolTip>

      <PatientNotesDialog patientId={patientId} open={open} onClose={() => setOpen(false)} />
    </>
  );
};
