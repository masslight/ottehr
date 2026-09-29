import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Button, ButtonGroup, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { ReactElement, useState } from 'react';
import { AssessmentIcon, HpiMoiIcon, MedicalRecordIcon } from '../icons';

const MENU_ID = 'ehr-links-menu';
const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

interface EhrLinksButtonProps {
  ehrUrl: string;
  appointmentId: string;
}

// Split button: "Visit Details" opens the EHR visit page; the arrow reveals
// deep links into the progress note's Assessment and HPI&MOI screens.
export function EhrLinksButton({ ehrUrl, appointmentId }: EhrLinksButtonProps): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const link = (icon: ReactElement, label: string, href: string): ReactElement => (
    <MenuItem component="a" href={href} {...NEW_TAB} onClick={() => setAnchor(null)}>
      <ListItemIcon sx={{ color: 'primary.main' }}>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </MenuItem>
  );

  return (
    <>
      <ButtonGroup variant="outlined" size="small">
        <Button
          startIcon={<MedicalRecordIcon sx={{ fontSize: '16px !important' }} />}
          href={`${ehrUrl}/visit/${appointmentId}`}
          {...NEW_TAB}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Visit Details
        </Button>
        <Button
          aria-haspopup="menu"
          aria-controls={anchor ? MENU_ID : undefined}
          aria-expanded={anchor ? 'true' : undefined}
          aria-label="More EHR links"
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ px: 0.5, minWidth: 0 }}
        >
          <ExpandMoreIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Menu
        id={MENU_ID}
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {link(<AssessmentIcon fontSize="small" />, 'Assessment', `${ehrUrl}/in-person/${appointmentId}/assessment`)}
        {link(
          <HpiMoiIcon fontSize="small" />,
          'HPI&MOI',
          `${ehrUrl}/in-person/${appointmentId}/history-of-present-illness-and-templates`
        )}
      </Menu>
    </>
  );
}
