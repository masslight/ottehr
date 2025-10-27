import AssignmentIcon from '@mui/icons-material/Assignment';
import { Box, Button, Collapse, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { Encounter } from 'fhir/r4b';
import { FC, useState } from 'react';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';

type EncounterSwitcherProps = {
  open: boolean;
};

export const EncounterSwitcher: FC<EncounterSwitcherProps> = ({ open }) => {
  const { followUpOriginEncounter, followupEncounters, selectedEncounterId, setSelectedEncounter } =
    useAppointmentData();
  const [isExpanded, setIsExpanded] = useState(false);

  const allEncounters = [followUpOriginEncounter, ...(followupEncounters || [])].filter(Boolean) as Encounter[];

  const handleEncounterSelect = (encounterId: string): void => {
    setSelectedEncounter(encounterId);
  };

  const getEncounterDisplayName = (encounter: Encounter): string => {
    if (!encounter.partOf) {
      return 'Main Visit';
    }

    const typeText = encounter.type?.[0]?.text || 'Follow-up';
    const date = encounter.period?.start ? formatISOStringToDateAndTime(encounter.period.start) : '';

    return `${typeText}${date ? ` - ${date}` : ''}`;
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
