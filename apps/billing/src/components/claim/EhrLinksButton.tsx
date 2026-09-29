import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Button, ButtonGroup, ListItemIcon, ListItemText, Menu, MenuItem, SvgIcon, SvgIconProps } from '@mui/material';
import { ReactElement, useState } from 'react';

// Icons copied from the EHR's sidebarMenuIcons so the links look the same in both apps.

// The EHR's 'Medical Conditions' icon — a medical-record sheet.
function MedicalRecordIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 16 20">
      <path
        d="M4 17h8v-2H4v2Zm0-3h8v-2H4v2Zm4-3.7c1.1-1 2.042-1.888 2.825-2.663C11.608 6.864 12 6.05 12 5.2c0-.6-.217-1.117-.65-1.55A2.116 2.116 0 0 0 9.8 3c-.35 0-.688.07-1.013.212A2.02 2.02 0 0 0 8 3.8a2.02 2.02 0 0 0-.787-.587A2.508 2.508 0 0 0 6.2 3c-.6 0-1.117.217-1.55.65C4.217 4.083 4 4.6 4 5.2c0 .85.38 1.65 1.138 2.4.758.75 1.712 1.65 2.862 2.7Zm6 9.7H2c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 18V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h12c.55 0 1.02.196 1.412.587C15.804.979 16 1.45 16 2v16c0 .55-.196 1.02-.588 1.413A1.926 1.926 0 0 1 14 20ZM2 18h12V2H2v16Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

// The EHR's 'Prescription' icon, used for its Assessment screen.
function AssessmentIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 20 20">
      <path
        d="M14 13C13.1667 13 12.4583 12.7083 11.875 12.125C11.2917 11.5417 11 10.8333 11 10C11 9.16667 11.2917 8.45833 11.875 7.875C12.4583 7.29167 13.1667 7 14 7C14.8333 7 15.5417 7.29167 16.125 7.875C16.7083 8.45833 17 9.16667 17 10C17 10.8333 16.7083 11.5417 16.125 12.125C15.5417 12.7083 14.8333 13 14 13ZM14 11C14.2833 11 14.5208 10.9042 14.7125 10.7125C14.9042 10.5208 15 10.2833 15 10C15 9.71667 14.9042 9.47917 14.7125 9.2875C14.5208 9.09583 14.2833 9 14 9C13.7167 9 13.4792 9.09583 13.2875 9.2875C13.0958 9.47917 13 9.71667 13 10C13 10.2833 13.0958 10.5208 13.2875 10.7125C13.4792 10.9042 13.7167 11 14 11ZM8 20V17.1C8 16.75 8.08333 16.4208 8.25 16.1125C8.41667 15.8042 8.65 15.5583 8.95 15.375C9.48333 15.0583 10.0458 14.7958 10.6375 14.5875C11.2292 14.3792 11.8333 14.225 12.45 14.125L14 16L15.55 14.125C16.1667 14.225 16.7667 14.3792 17.35 14.5875C17.9333 14.7958 18.4917 15.0583 19.025 15.375C19.325 15.5583 19.5625 15.8042 19.7375 16.1125C19.9125 16.4208 20 16.75 20 17.1V20H8ZM9.975 18H13.05L11.7 16.35C11.4 16.4333 11.1083 16.5417 10.825 16.675C10.5417 16.8083 10.2583 16.95 9.975 17.1V18ZM14.95 18H18V17.1C17.7333 16.9333 17.4583 16.7875 17.175 16.6625C16.8917 16.5375 16.6 16.4333 16.3 16.35L14.95 18ZM2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16C16.55 0 17.0208 0.195833 17.4125 0.5875C17.8042 0.979167 18 1.45 18 2V7C17.7333 6.66667 17.4417 6.35 17.125 6.05C16.8083 5.75 16.4333 5.55 16 5.45V2H2V16H6.15C6.1 16.1833 6.0625 16.3667 6.0375 16.55C6.0125 16.7333 6 16.9167 6 17.1V18H2ZM4 6H11C11.4333 5.66667 11.9083 5.41667 12.425 5.25C12.9417 5.08333 13.4667 5 14 5V4H4V6ZM4 10H9C9 9.65 9.0375 9.30833 9.1125 8.975C9.1875 8.64167 9.29167 8.31667 9.425 8H4V10ZM4 14H7.45C7.63333 13.85 7.82917 13.7167 8.0375 13.6C8.24583 13.4833 8.45833 13.375 8.675 13.275V12H4V14ZM2 16V2V5.425V5V16Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

// The EHR's 'History' icon, used for its HPI/MOI & Templates screen.
function HpiMoiIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="0 0 20 16">
      <path
        d="M6.5 16C5.95 16 5.47917 15.8042 5.0875 15.4125C4.69583 15.0208 4.5 14.55 4.5 14V11H7.5V8.75C6.91667 8.71667 6.3625 8.5875 5.8375 8.3625C5.3125 8.1375 4.83333 7.8 4.4 7.35V6.25H3.25L0 3C0.6 2.23333 1.34167 1.69167 2.225 1.375C3.10833 1.05833 4 0.9 4.9 0.9C5.35 0.9 5.7875 0.933333 6.2125 1C6.6375 1.06667 7.06667 1.19167 7.5 1.375V0H19.5V13C19.5 13.8333 19.2083 14.5417 18.625 15.125C18.0417 15.7083 17.3333 16 16.5 16H6.5ZM9.5 11H15.5V13C15.5 13.2833 15.5958 13.5208 15.7875 13.7125C15.9792 13.9042 16.2167 14 16.5 14C16.7833 14 17.0208 13.9042 17.2125 13.7125C17.4042 13.5208 17.5 13.2833 17.5 13V2H9.5V2.6L15.5 8.6V10H14.1L11.25 7.15L11.05 7.35C10.8167 7.58333 10.5708 7.79167 10.3125 7.975C10.0542 8.15833 9.78333 8.3 9.5 8.4V11ZM4.1 4.25H6.4V6.4C6.6 6.53333 6.80833 6.625 7.025 6.675C7.24167 6.725 7.46667 6.75 7.7 6.75C8.08333 6.75 8.42917 6.69167 8.7375 6.575C9.04583 6.45833 9.35 6.25 9.65 5.95L9.85 5.75L8.45 4.35C7.96667 3.86667 7.425 3.50417 6.825 3.2625C6.225 3.02083 5.58333 2.9 4.9 2.9C4.56667 2.9 4.25 2.925 3.95 2.975C3.65 3.025 3.35 3.1 3.05 3.2L4.1 4.25ZM13.5 13H6.5V14H13.65C13.6 13.85 13.5625 13.6917 13.5375 13.525C13.5125 13.3583 13.5 13.1833 13.5 13Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

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
