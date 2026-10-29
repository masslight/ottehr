import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Button, Dialog, IconButton, Tooltip } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, Fragment, useState } from 'react';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { compoundDetailsText, quantityText } from './prescriptionLines';
import { erxEventText } from './prescriptionStatus';

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
              {erxEventText(event)}
              {who && <span className="who">{who}</span>}
            </span>
          </Box>
        );
      })}
    </Box>
  );
};

/** An action icon: hovering shows `content` in a card; a click opens it in a dialog titled "`label` · name". */
const PanelButton: FC<{
  label: string;
  icon: JSX.Element;
  prescription: PrescribedMedicationDTO;
  subtitle?: string;
  content: JSX.Element;
}> = ({ label, icon, prescription, subtitle, content }) => {
  const [open, setOpen] = useState(false);
  const titleId = `prescription-${label.toLowerCase()}-title`;
  return (
    <>
      <Tooltip title={content} componentsProps={{ tooltip: { sx: { ...PANEL_SX, maxWidth: 560 } } }}>
        <IconButton aria-label={label} size="small" onClick={() => setOpen(true)}>
          {icon}
        </IconButton>
      </Tooltip>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="sm"
          aria-labelledby={titleId}
          PaperProps={{ sx: { ...PANEL_SX, display: 'flex', flexDirection: 'column', gap: '10px' } }}
        >
          <Box id={titleId} sx={{ fontSize: '18px', fontWeight: 600, color: '#0A2143' }}>
            {label} · {prescription.name}
          </Box>
          {subtitle && <Box sx={{ fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>{subtitle}</Box>}
          {content}
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

/** Hovering shows the timeline; a click opens it in a dialog with the pharmacy and visit. */
export const PrescriptionHistoryButton: FC<PrescriptionTimelineProps & { visitDate?: string }> = ({
  visitDate,
  ...props
}) => (
  <PanelButton
    label="History"
    icon={<HistoryIcon fontSize="small" />}
    prescription={props.prescription}
    subtitle={[props.prescription.pharmacyName, visitDate && `visit ${visitDate}`].filter(Boolean).join(' · ')}
    content={<PrescriptionTimeline {...props} />}
  />
);

/** The order as sent, one labelled line per field it has. */
const PrescriptionDetails: FC<PrescriptionTimelineProps> = ({ prescription, practitionerName, practitioners }) => {
  const order = prescription.order ?? {};
  const sent = formatDateToMDYWithTime(prescription.sent, DateTime.local().zoneName);
  const rows: [string, string | undefined][] = [
    [
      'Medication',
      order.compound ? `Compound: ${prescription.name} · ${compoundDetailsText(order.compound)}` : prescription.name,
    ],
    ['Directions', prescription.instructions],
    ['Quantity', quantityText(order.quantityValue, order.quantityUnit)],
    ['Days supply', order.daysSupply?.toString()],
    ['Refills', order.numberOfRefills?.toString()],
    [
      'Substitution',
      order.substitutionAllowed === undefined ? undefined : order.substitutionAllowed ? 'Allowed' : 'Not allowed',
    ],
    ['Note to pharmacy', order.noteToPharmacy],
    ['Diagnosis', [order.diagnosisCode, order.diagnosisDescription].filter(Boolean).join(' ') || undefined],
    ['Pharmacy', prescription.pharmacyName],
    ['Sent', sent && `${sent.date} ${sent.time}`],
    ['Prescriber', practitionerName(practitioners?.find((practitioner) => practitioner.id === prescription.provider))],
  ];
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: '128px minmax(0,1fr)',
        gap: '4px 10px',
        m: 0,
        fontSize: '13.5px',
        color: 'rgba(0,0,0,.87)',
      }}
    >
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <Fragment key={label}>
            <Box component="dt" sx={{ color: MUTED }}>
              {label}
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              {value}
            </Box>
          </Fragment>
        ))}
    </Box>
  );
};

/** Hovering shows the order's details; a click opens them in a dialog. */
export const PrescriptionDetailsButton: FC<PrescriptionTimelineProps> = (props) => (
  <PanelButton
    label="Details"
    icon={<InfoOutlinedIcon fontSize="small" />}
    prescription={props.prescription}
    content={<PrescriptionDetails {...props} />}
  />
);
