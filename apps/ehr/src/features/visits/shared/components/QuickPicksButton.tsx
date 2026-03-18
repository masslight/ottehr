import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import { Button, Divider, Menu, MenuItem, Stack, Tooltip } from '@mui/material';
import { useState } from 'react';

interface QuickPicksButtonProps<T> {
  quickPicks: T[];
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  onSaveQuickPick?: () => void;
  saveQuickPickDisabled?: boolean;
  saveQuickPickTooltip?: string;
  disabled?: boolean;
}

export const QuickPicksButton = <T,>({
  quickPicks,
  getLabel,
  onSelect,
  onSaveQuickPick,
  saveQuickPickDisabled = false,
  saveQuickPickTooltip,
  disabled = false,
}: QuickPicksButtonProps<T>): JSX.Element | null => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (quickPicks.length === 0 && !onSaveQuickPick) {
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

  const handleSaveQuickPick = (): void => {
    onSaveQuickPick?.();
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
        {onSaveQuickPick != null && (
          <Tooltip title={saveQuickPickDisabled ? saveQuickPickTooltip : ''} placement="right">
            <span>
              <MenuItem
                onClick={handleSaveQuickPick}
                disabled={saveQuickPickDisabled}
                sx={{ fontWeight: 500, color: saveQuickPickDisabled ? 'text.disabled' : 'primary.main' }}
              >
                + Add or Update Quick Pick
              </MenuItem>
            </span>
          </Tooltip>
        )}
        {onSaveQuickPick != null && quickPicks.length > 0 && <Divider />}
        {quickPicks.map((item, index) => (
          <MenuItem key={index} onClick={() => handleSelect(item)}>
            {getLabel(item)}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
};
