import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Dialog,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalQuickPicks } from '../hooks/useGlobalQuickPicks';
import { useNavigationQuickPicks } from '../hooks/useNavigationQuickPicks';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';

/** Sentinel item shown when the query doesn't match any items */
const PATIENT_SEARCH_ID = '__patient-search__';

export const CommandPalette: FC = () => {
  useGlobalQuickPicks();
  useNavigationQuickPicks();
  const navigate = useNavigate();
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
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.keywords?.some((kw) => kw.toLowerCase().includes(lower))
    );
  }, [allItems, query]);

  // When the user has typed something that doesn't match any items,
  // show a "Search patients for ..." fallback option
  const showPatientSearchFallback = query.trim().length > 0 && filteredItems.length === 0;
  const displayItems = useMemo(() => {
    if (!showPatientSearchFallback) return filteredItems;
    return [
      {
        id: PATIENT_SEARCH_ID,
        label: `Search patients for "${query.trim()}"`,
        category: 'Search',
        onSelect: () => {
          /* handled in handleSelect */
        },
      },
    ];
  }, [filteredItems, showPatientSearchFallback, query]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandPaletteItem[]> = {};
    for (const item of displayItems) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  }, [displayItems]);

  // Reset state and ensure focus when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= displayItems.length) {
      setSelectedIndex(Math.max(0, displayItems.length - 1));
    }
  }, [displayItems.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector('[data-selected="true"]');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handlePatientSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      // If it looks like an ID (UUID or numeric), search by PID; otherwise search by name
      const isId =
        /^\d+$/.test(trimmed) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      if (isId) {
        navigate(`/patients?pid=${encodeURIComponent(trimmed)}`);
      } else {
        // Split into first/last name parts
        const parts = trimmed.split(/\s+/);
        const params = new URLSearchParams();
        if (parts.length >= 2) {
          params.set('givenNames', parts.slice(0, -1).join(' '));
          params.set('lastName', parts[parts.length - 1]);
        } else {
          params.set('lastName', trimmed);
        }
        navigate(`/patients?${params.toString()}`);
      }
    },
    [navigate]
  );

  const handleSelect = useCallback(
    (item: CommandPaletteItem) => {
      if (item.id === PATIENT_SEARCH_ID) {
        handlePatientSearch(query);
      } else {
        item.onSelect();
      }
      close();
    },
    [close, query, handlePatientSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, displayItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayItems[selectedIndex]) {
            handleSelect(displayItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [displayItems, selectedIndex, handleSelect, close]
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
          placeholder="Search by patient name/ID or jump to..."
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
        <List ref={listRef} sx={{ maxHeight: 'calc(60vh - 64px)', overflow: 'auto', py: 1 }}>
          {displayItems.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {query.trim() ? `No results for \u201c${query}\u201d` : 'Type to search or navigate'}
              </Typography>
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
                    const flatIndex = displayItems.indexOf(item);
                    const isSelected = flatIndex === selectedIndex;
                    const isPatientSearch = item.id === PATIENT_SEARCH_ID;
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
                        {isPatientSearch && (
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <PersonSearchIcon fontSize="small" sx={{ color: 'primary.main' }} />
                          </ListItemIcon>
                        )}
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: '14px',
                            ...(isPatientSearch && { color: 'primary.main', fontWeight: 500 }),
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </Box>
              ))
          )}
        </List>
      </Box>
    </Dialog>
  );
};
