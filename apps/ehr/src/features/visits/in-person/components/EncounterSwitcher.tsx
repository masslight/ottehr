import AssignmentIcon from '@mui/icons-material/Assignment';
import { Box, Button, Collapse, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Appointment as FhirAppointment, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { CHART_DATA_QUERY_KEY } from 'src/constants';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { isScheduledFollowupEncounter } from 'utils';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import { resetExamObservationsStore } from '../../shared/stores/appointment/reset-exam-observations';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

type EncounterSwitcherProps = {
  open: boolean;
};

export const EncounterSwitcher: FC<EncounterSwitcherProps> = ({ open }) => {
  const { followUpOriginEncounter, followupEncounters, selectedEncounterId, setSelectedEncounter, rawResources } =
    useAppointmentData();
  const [isExpanded, setIsExpanded] = useState(true);
  const { setInteractionMode } = useInPersonNavigationContext();
  const queryClient = useQueryClient();

  // Build a map from appointment ID to appointment start time for date lookups
  const appointmentStartMap = useMemo(() => {
    const map: Record<string, string> = {};
    rawResources?.forEach((r) => {
      if (r.resourceType === 'Appointment' && r.id && (r as FhirAppointment).start) {
        map[r.id] = (r as FhirAppointment).start!;
      }
    });
    return map;
  }, [rawResources]);

  const getEncounterDateTime = (encounter: Encounter): string | undefined => {
    // First try: appointment start time (the scheduled date)
    const apptId = encounter.appointment?.[0]?.reference?.replace('Appointment/', '');
    if (apptId && appointmentStartMap[apptId]) {
      return appointmentStartMap[apptId];
    }
    // Second try: encounter period start
    if (encounter.period?.start) {
      return encounter.period.start;
    }
    // Third try: first statusHistory entry
    return encounter.statusHistory?.[0]?.period?.start;
  };

  const sortedFollowupEncounters = [...(followupEncounters || [])].filter(Boolean).sort((a, b) => {
    return DateTime.fromISO(getEncounterDateTime(a) ?? '').diff(
      DateTime.fromISO(getEncounterDateTime(b) ?? ''),
      'milliseconds'
    ).milliseconds;
  });

  const allEncounters = [followUpOriginEncounter, ...sortedFollowupEncounters].filter(Boolean) as Encounter[];

  const handleEncounterSelect = (encounterId: string): void => {
    // Reset exam observations and invalidate chart data cache so it refetches
    // and repopulates the exam store for the new encounter
    resetExamObservationsStore();
    void queryClient.invalidateQueries({
      queryKey: [CHART_DATA_QUERY_KEY, encounterId],
      exact: false,
    });
    setSelectedEncounter(encounterId);
    if (encounterId === followUpOriginEncounter?.id) {
      setInteractionMode('main', true);
    } else {
      const selectedEnc = allEncounters.find((e) => e.id === encounterId);
      if (selectedEnc && isScheduledFollowupEncounter(selectedEnc)) {
        setInteractionMode('main', true);
      } else {
        setInteractionMode('follow-up', true);
      }
    }
  };

  const getEncounterDisplayName = (encounter: Encounter): string => {
    const date = getEncounterDateTime(encounter);
    const dateStr = date ? formatISOStringToDateAndTime(date) : '';

    if (!encounter.partOf) {
      return `Main Visit${dateStr ? ` - ${dateStr}` : ''}`;
    }

    const typeText = encounter.type?.[0]?.text || 'Follow-up';
    return `${typeText}${dateStr ? ` - ${dateStr}` : ''}`;
  };

  if (allEncounters.length <= 1) {
    return null;
  }

  return (
    <Box sx={{ borderBottom: '1px solid #e0e0e0' }}>
      <Button
        fullWidth
        onClick={() => open && setIsExpanded(!isExpanded)}
        disabled={!open}
        sx={{
          justifyContent: 'space-between',
          textTransform: 'none',
          color: 'text.primary',
          padding: '12px 16px',
          '&:hover': {
            backgroundColor: open ? 'action.hover' : 'transparent',
          },
          '&:disabled': {
            color: 'text.disabled',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon sx={{ fontSize: 20, color: open ? 'primary.main' : 'text.disabled' }} />
          {open && (
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Encounters ({allEncounters.length})
            </Typography>
          )}
        </Box>
        {open && (
          <Typography variant="body2" sx={{ color: 'primary.main' }}>
            {isExpanded ? '▼' : '▶'}
          </Typography>
        )}
      </Button>

      <Collapse in={isExpanded && open}>
        <List sx={{ padding: 0 }}>
          {allEncounters.map((enc) => (
            <ListItem key={enc.id} disablePadding>
              <ListItemButton
                selected={enc.id === selectedEncounterId}
                onClick={() => handleEncounterSelect(enc.id!)}
                sx={{
                  padding: '8px 16px',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                    },
                  },
                }}
              >
                <ListItemText
                  primary={getEncounterDisplayName(enc)}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontSize: '0.875rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Box>
  );
};
