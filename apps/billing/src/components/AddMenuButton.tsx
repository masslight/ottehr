import { Add as AddIcon, KeyboardArrowDown as KeyboardArrowDownIcon } from '@mui/icons-material';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { ReactElement, ReactNode, useState } from 'react';

export interface AddMenuOption {
  label: string;
  description: string;
  icon: ReactNode;
  onSelect: () => void;
}

// "+ Add ▾": a button opening a menu of ways to add something, each with a line saying what it does.
export function AddMenuButton({
  options,
  disabledReason,
  size = 'medium',
}: {
  options: AddMenuOption[];
  // when set, the button is disabled and this explains why
  disabledReason?: string;
  size?: 'small' | 'medium';
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title={disabledReason ?? ''}>
        <span>
          <Button
            variant="contained"
            size={size}
            startIcon={<AddIcon />}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(event) => setAnchor(event.currentTarget)}
            disabled={!!disabledReason}
            aria-haspopup="menu"
          >
            Add
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.label}
            onClick={() => {
              setAnchor(null);
              option.onSelect();
            }}
            sx={{ py: 1.25, pr: 3 }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText primary={option.label} secondary={option.description} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
