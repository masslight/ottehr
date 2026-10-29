import HistoryIcon from '@mui/icons-material/History';
import { Box, Button, Dialog, IconButton, Tooltip } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

// From the approved order history mockup (erx-order-history.html)
const EDGE = '#DFE5E9';
const MUTED = 'rgba(0,0,0,.6)';
const FAINT = 'rgba(0,0,0,.45)';
const PANEL_SX = {
  border: `1px solid ${EDGE}`,
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(15,52,124,.14)',
  background: '#FFFFFF',
  padding: '14px 16px',
};

// The rail's dot: green when accepted or filled, orange for a cancellation, blue otherwise.
const OK_CODES = ['accepted', 'dispensed', 'partiallydispensed'];
const CANCEL_CODES = ['cancelrequested', 'cancelled', 'canceldenied'];
const dotColor = (code: string): string =>
  OK_CODES.includes(code) ? '#2E7D32' : CANCEL_CODES.includes(code) ? '#ED6C02' : '#1976D2';

const TIMELINE_SX = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: '13.5px',
  color: 'rgba(0,0,0,.87)',
  '& .ev': { display: 'grid', gridTemplateColumns: '128px 14px minmax(0,1fr)', gap: '10px' },
  '& .when': {
    color: MUTED,
    textAlign: 'right',
    padding: '5px 0',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  '& .rail': { position: 'relative' },
  '& .rail::before': {
    content: '""',
    position: 'absolute',
    left: '6px',
    top: 0,
    bottom: 0,
    width: '2px',
    background: EDGE,
  },
  '& .ev:first-of-type .rail::before': { top: '11px' },
  '& .ev:last-of-type .rail::before': { bottom: 'calc(100% - 11px)' },
  '& .rail::after': {
    content: '""',
    position: 'absolute',
    left: '2px',
    top: '8px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'var(--dot)',
  },
  '& .what': { padding: '5px 0' },
  '& .who': { color: FAINT, fontSize: '12px', marginLeft: '6px' },
};

interface PrescriptionTimelineProps {
  prescription: PrescribedMedicationDTO;
  practitionerName: (practitioner?: Practitioner) => string | undefined;
  practitioners?: Practitioner[];
}

/** The prescription's eRx events, oldest first, each in the service's own words with who did it and when. */
export const PrescriptionTimeline: FC<PrescriptionTimelineProps> = ({
  prescription,
  practitionerName,
  practitioners,
}) => {
  const events = prescription.events ?? [];
  if (events.length === 0) return <Box sx={{ fontSize: '13.5px' }}>No history yet</Box>;
  return (
    <Box component="ol" sx={{ ...TIMELINE_SX, listStyle: 'none', m: 0, p: 0 }}>
      {events.map((event, index) => {
        const who =
          practitionerName(practitioners?.find((practitioner) => practitioner.id === event.agentPractitionerId)) ??
          event.agent;
        return (
          <Box component="li" key={index} className="ev" sx={{ '--dot': dotColor(event.code) }}>
            <span className="when">
              {event.recorded && DateTime.fromISO(event.recorded).toLocal().toFormat('MM/dd h:mm a')}
            </span>
            <span className="rail" />
            <span className="what">
              {event.text}
              {who && <span className="who">{who}</span>}
            </span>
          </Box>
        );
      })}
    </Box>
  );
};

/** Hovering shows the timeline; a click opens it in a dialog with the pharmacy and visit. */
export const PrescriptionHistoryButton: FC<PrescriptionTimelineProps & { visitDate?: string }> = ({
  visitDate,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip
        title={<PrescriptionTimeline {...props} />}
        componentsProps={{ tooltip: { sx: { ...PANEL_SX, maxWidth: 560 } } }}
      >
        <IconButton aria-label="History" size="small" onClick={() => setOpen(true)}>
          <HistoryIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="prescription-history-title"
          PaperProps={{ sx: { ...PANEL_SX, display: 'flex', flexDirection: 'column', gap: '10px' } }}
        >
          <Box id="prescription-history-title" sx={{ fontSize: '18px', fontWeight: 600, color: '#0A2143' }}>
            History · {props.prescription.name}
          </Box>
          <Box sx={{ fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>
            {[props.prescription.pharmacyName, visitDate && `visit ${visitDate}`].filter(Boolean).join(' · ')}
          </Box>
          <PrescriptionTimeline {...props} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={() => setOpen(false)}
              sx={{
                borderRadius: '20px',
                padding: '5px 16px',
                fontSize: '13.5px',
                fontWeight: 500,
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Close
            </Button>
          </Box>
        </Dialog>
      )}
    </>
  );
};
