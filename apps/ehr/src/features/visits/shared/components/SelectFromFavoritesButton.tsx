import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import { Button, Menu, MenuItem, Stack } from '@mui/material';
import { useState } from 'react';

interface SelectFromFavoritesButtonProps<T> {
  favorites: T[];
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  disabled?: boolean;
}

export const SelectFromFavoritesButton = <T,>({
  favorites,
  getLabel,
  onSelect,
  disabled = false,
}: SelectFromFavoritesButtonProps<T>): JSX.Element | null => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (favorites.length === 0) {
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
        Select from favorite
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {favorites.map((item, index) => (
          <MenuItem key={index} onClick={() => handleSelect(item)}>
            {getLabel(item)}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
};
