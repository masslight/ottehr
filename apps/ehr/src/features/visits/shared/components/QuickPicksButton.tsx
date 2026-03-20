import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import { Button, Divider, Menu, MenuItem, Stack } from '@mui/material';
import { useState } from 'react';

interface QuickPicksButtonProps<T> {
  quickPicks: T[];
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  disabled?: boolean;
  showAddOption?: boolean;
  isAdmin?: boolean;
  onAddOrUpdate?: () => void;
}

export const QuickPicksButton = <T,>({
  quickPicks,
  getLabel,
  onSelect,
  disabled = false,
  showAddOption = false,
  isAdmin = false,
  onAddOrUpdate,
}: QuickPicksButtonProps<T>): JSX.Element | null => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (quickPicks.length === 0 && !showAddOption) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleSelect = (item: T): void => {
    onSelect(item);
    handleClose();
  };

  return (
    <Stack alignItems="flex-start" sx={{ mb: 0.5 }}>
      <Button
        size="small"
        onClick={handleClick}
        disabled={disabled}
        startIcon={<BookmarkBorderOutlinedIcon />}
        endIcon={<ArrowDropDownIcon />}
        sx={{
          textTransform: 'none',
          mb: 0.5,
        }}
      >
        Quick Picks
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {showAddOption &&
          (isAdmin ? (
            <MenuItem
              onClick={() => {
                handleClose();
                onAddOrUpdate?.();
              }}
              sx={{ fontWeight: 'bold', color: 'primary.main' }}
            >
              + Add or Update Quick Pick
            </MenuItem>
          ) : (
            <MenuItem disabled sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
              Add Or Update Quick Pick Requires Admin Role
            </MenuItem>
          ))}
        {showAddOption && quickPicks.length > 0 && <Divider />}
        {quickPicks.map((item, index) => (
          <MenuItem key={index} onClick={() => handleSelect(item)}>
            {getLabel(item)}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
};
