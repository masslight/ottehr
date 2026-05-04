import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Button, Divider, InputAdornment, Menu, MenuItem, Stack, TextField } from '@mui/material';
import React, { useRef, useState } from 'react';

interface QuickPicksButtonProps<T> {
  quickPicks: T[];
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  disabled?: boolean;
  loading?: boolean;
  showAddOption?: boolean;
  isAdmin?: boolean;
  onAddOrUpdate?: () => void;
  searchable?: boolean;
}

export const QuickPicksButton = <T,>({
  quickPicks,
  getLabel,
  onSelect,
  disabled = false,
  loading = false,
  showAddOption = false,
  isAdmin = false,
  onAddOrUpdate,
  searchable = false,
}: QuickPicksButtonProps<T>): JSX.Element | null => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchText, setSearchText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const open = Boolean(anchorEl);

  if (quickPicks.length === 0 && !showAddOption && !loading) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
    setSearchText('');
    setHighlightedIndex(-1);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
    setSearchText('');
    setHighlightedIndex(-1);
  };

  const handleSelect = (item: T): void => {
    onSelect(item);
    handleClose();
  };

  const query = searchText.toLowerCase();
  const filteredQuickPicks =
    searchable && query ? quickPicks.filter((item) => getLabel(item).toLowerCase().includes(query)) : quickPicks;

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredQuickPicks.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < filteredQuickPicks.length) {
      e.preventDefault();
      handleSelect(filteredQuickPicks[highlightedIndex]);
    } else if (e.key === 'Escape') {
      handleClose();
    }
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
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        {...(searchable
          ? {
              autoFocus: false,
              disableAutoFocusItem: true,
              slotProps: { paper: { sx: { maxHeight: 400 } } },
              TransitionProps: {
                onEntered: () => {
                  searchInputRef.current?.focus();
                },
              },
            }
          : {})}
      >
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
        {searchable && quickPicks.length > 0 && (
          <MenuItem
            disableRipple
            disableTouchRipple
            sx={{
              '&:hover': { backgroundColor: 'transparent' },
              '&.Mui-focusVisible': { backgroundColor: 'transparent' },
              cursor: 'default',
              px: 2,
              py: 1,
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Search..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              inputRef={searchInputRef}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </MenuItem>
        )}
        {(showAddOption || searchable) && (filteredQuickPicks.length > 0 || loading) && <Divider />}
        {loading && quickPicks.length === 0 && (
          <MenuItem disabled sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
            Loading…
          </MenuItem>
        )}
        {filteredQuickPicks.map((item, index) => (
          <MenuItem
            key={getLabel(item)}
            onClick={() => handleSelect(item)}
            selected={searchable && index === highlightedIndex}
          >
            {getLabel(item)}
          </MenuItem>
        ))}
        {searchable && searchText && filteredQuickPicks.length === 0 && !loading && (
          <MenuItem disabled sx={{ fontStyle: 'italic' }}>
            No matches
          </MenuItem>
        )}
      </Menu>
    </Stack>
  );
};
