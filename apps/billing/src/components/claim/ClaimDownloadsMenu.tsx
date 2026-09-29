import {
  DataObjectOutlined as DataObjectIcon,
  DescriptionOutlined as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  FileDownloadOutlined as FileDownloadIcon,
  PrintOutlined as PrintIcon,
} from '@mui/icons-material';
import { Button, CircularProgress, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { ReactElement, ReactNode, useState } from 'react';

const MENU_ID = 'claim-downloads-menu';

interface ClaimDownloadsMenuProps {
  claimType: string;
  onExportX12: () => void;
  onCms1500: () => void;
  onProofOfTimelyFiling: () => void;
  // The proof of timely filing is being put together.
  buildingProof: boolean;
}

// The files a claim can be turned into, under one button in the claim page's header.
export function ClaimDownloadsMenu({
  claimType,
  onExportX12,
  onCms1500,
  onProofOfTimelyFiling,
  buildingProof,
}: ClaimDownloadsMenuProps): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const professional = claimType === 'professional';

  const item = (
    icon: ReactNode,
    primary: string,
    secondary: string,
    onClick: () => void,
    disabled = false
  ): ReactElement => (
    <MenuItem
      disabled={disabled}
      onClick={() => {
        setAnchor(null);
        onClick();
      }}
    >
      <ListItemIcon sx={{ color: 'primary.main' }}>{icon}</ListItemIcon>
      <ListItemText primary={primary} secondary={secondary} />
    </MenuItem>
  );

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={buildingProof ? <CircularProgress size={16} /> : <FileDownloadIcon />}
        endIcon={<ExpandMoreIcon />}
        aria-haspopup="menu"
        aria-controls={anchor ? MENU_ID : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Downloads
      </Button>
      <Menu
        id={MENU_ID}
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {item(<DataObjectIcon />, 'Export X12', `The ${professional ? '837P' : '837I'} file`, onExportX12)}
        {professional && item(<PrintIcon />, 'CMS-1500', 'Print or download the paper claim', onCms1500)}
        {item(
          <DescriptionIcon />,
          'Proof of timely filing',
          'Submission history as a PDF',
          onProofOfTimelyFiling,
          buildingProof
        )}
      </Menu>
    </>
  );
}
