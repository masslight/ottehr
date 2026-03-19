import SearchIcon from '@mui/icons-material/Search';
import { Box, Dialog, InputAdornment, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';

export const CommandPalette: FC = () => {
  useGlobalQuickPicks();
  const { isOpen, close, toggle, sources } = useCommandPaletteStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const allItems = useMemo(() => {
    const items: CommandPaletteItem[] = [];
    for (const source of Object.values(sources)) {
      items.push(...source.items);
    }
    return items;
  }, [sources]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter(
      (item) => item.label.toLowerCase().includes(lower) || item.category.toLowerCase().includes(lower)
    );
  }, [allItems, query]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandPaletteItem[]> = {};
    for (const item of filteredItems) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredItems]);

  // Reset state and ensure focus when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Ensure the input gets focus even after page navigation
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector('[data-selected="true"]');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (item: CommandPaletteItem) => {
      item.onSelect();
      close();
    },
    [close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [filteredItems, selectedIndex, handleSelect, close]
  );

  // Global keyboard shortcut — skip when focus is in an editable element
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const target = e.target as HTMLElement;
        const isEditable =
          target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
        // Allow toggle when palette is already open (input inside the dialog)
        if (isEditable && !isOpen) return;
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle, isOpen]);

  const hasItems = allItems.length > 0;

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '60vh',
          overflow: 'hidden',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
        },
      }}
    >
      <Box>
        <TextField
          inputRef={inputRef}
          autoFocus
          fullWidth
          onKeyDown={handleKeyDown}
          placeholder={
            hasItems ? 'Search quick picks... (type a category like "allergies")' : 'No quick picks available'
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                  {navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                </Typography>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiInputBase-root': { py: 1.5, px: 1 },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        />
        {hasItems && (
          <List ref={listRef} sx={{ maxHeight: 'calc(60vh - 64px)', overflow: 'auto', py: 1 }}>
            {filteredItems.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">No results for &ldquo;{query}&rdquo;</Typography>
              </Box>
            ) : (
              Object.entries(groupedItems)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, items]) => (
                  <Box key={category}>
                    <Typography
                      variant="caption"
                      sx={{
                        px: 2,
                        py: 0.5,
                        display: 'block',
                        color: 'text.secondary',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: '11px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {category}
                    </Typography>
                    {items.map((item) => {
                      const flatIndex = filteredItems.indexOf(item);
                      const isSelected = flatIndex === selectedIndex;
                      return (
                        <ListItemButton
                          key={item.id}
                          data-selected={isSelected}
                          selected={isSelected}
                          onClick={() => handleSelect(item)}
                          sx={{
                            mx: 1,
                            borderRadius: 1,
                            py: 0.75,
                          }}
                        >
                          <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '14px' }} />
                        </ListItemButton>
                      );
                    })}
                  </Box>
                ))
            )}
          </List>
        )}
      </Box>
    </Dialog>
  );
};
