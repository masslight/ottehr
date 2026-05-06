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
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';

const PATIENT_SEARCH_ITEM_ID = '__patient-search__';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sortItems = (items: CommandPaletteItem[]): CommandPaletteItem[] =>
  [...items].sort((left, right) => {
    const categoryComparison = left.category.localeCompare(right.category);
    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    return left.label.localeCompare(right.label);
  });

const buildPatientSearchUrl = (query: string): string => {
  const trimmedQuery = query.trim();

  if (/^\d+$/.test(trimmedQuery) || uuidPattern.test(trimmedQuery)) {
    return `/patients?pid=${encodeURIComponent(trimmedQuery)}`;
  }

  const parts = trimmedQuery.split(/\s+/);
  const params = new URLSearchParams();

  if (parts.length >= 2) {
    params.set('givenNames', parts.slice(0, -1).join(' '));
    params.set('lastName', parts[parts.length - 1]);
  } else {
    params.set('lastName', trimmedQuery);
  }

  return `/patients?${params.toString()}`;
};

export const CommandPalette: FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const close = useCommandPaletteStore((state) => state.close);
  const toggle = useCommandPaletteStore((state) => state.toggle);
  const sources = useCommandPaletteStore((state) => state.sources);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allItems = useMemo(() => {
    const uniqueItems = new Map<string, CommandPaletteItem>();

    Object.values(sources).forEach((source) => {
      source.items.forEach((item) => {
        if (!uniqueItems.has(item.id)) {
          uniqueItems.set(item.id, item);
        }
      });
    });

    return sortItems([...uniqueItems.values()]);
  }, [sources]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allItems;
    }

    const normalizedQuery = query.trim().toLowerCase();

    return allItems.filter((item) => {
      const searchableValues = [item.label, item.category, ...(item.keywords ?? [])];
      return searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [allItems, query]);

  const displayItems = useMemo<CommandPaletteItem[]>(() => {
    if (filteredItems.length > 0 || !query.trim()) {
      return filteredItems;
    }

    return [
      {
        id: PATIENT_SEARCH_ITEM_ID,
        label: `Search patients for "${query.trim()}"`,
        category: 'Search',
        onSelect: () => navigate(buildPatientSearchUrl(query)),
      },
    ];
  }, [filteredItems, navigate, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, CommandPaletteItem[]>();

    displayItems.forEach((item) => {
      const existingItems = groups.get(item.category) ?? [];
      existingItems.push(item);
      groups.set(item.category, existingItems);
    });

    return [...groups.entries()];
  }, [displayItems]);

  const orderedIds = useMemo(() => displayItems.map((item) => item.id), [displayItems]);

  useEffect(() => {
    if (!orderedIds.length) {
      setSelectedId(null);
      return;
    }

    setSelectedId((currentSelectedId) => {
      if (currentSelectedId && orderedIds.includes(currentSelectedId)) {
        return currentSelectedId;
      }

      return orderedIds[0];
    });
  }, [orderedIds]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery('');
    setSelectedId(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!selectedId || !listRef.current) {
      return;
    }

    const selectedElement = listRef.current.querySelector<HTMLElement>(`[data-item-id="${selectedId}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (!isOpen) {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLElement) {
            const tagName = activeElement.tagName;
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeElement.isContentEditable) {
              return;
            }
          }
        }
        event.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle]);

  const selectItem = useCallback(
    (item: CommandPaletteItem) => {
      item.onSelect();
      close();
    },
    [close]
  );

  const moveSelection = useCallback(
    (offset: number) => {
      if (!orderedIds.length) {
        return;
      }

      setSelectedId((currentSelectedId) => {
        if (!currentSelectedId) {
          return offset > 0 ? orderedIds[0] : orderedIds[orderedIds.length - 1];
        }

        const currentIndex = orderedIds.indexOf(currentSelectedId);
        const nextIndex = (currentIndex + offset + orderedIds.length) % orderedIds.length;
        return orderedIds[nextIndex];
      });
    },
    [orderedIds]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selectedItem = displayItems.find((item) => item.id === selectedId) ?? displayItems[0];
        if (selectedItem) {
          selectItem(selectedItem);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    },
    [close, displayItems, moveSelection, selectItem, selectedId]
  );

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '60vh',
          overflow: 'hidden',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
      }}
    >
      <Box>
        <TextField
          inputRef={inputRef}
          autoFocus
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search actions, pages, templates, or patients"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                  {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                </Typography>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
            '& .MuiInputBase-root': {
              px: 1,
              py: 1.5,
            },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        />

        <List ref={listRef} sx={{ maxHeight: 'calc(60vh - 72px)', overflow: 'auto', py: 1 }}>
          {displayItems.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Type to search actions and pages</Typography>
            </Box>
          ) : (
            groupedItems.map(([category, items]) => (
              <Box key={category}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 2,
                    py: 0.5,
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
                  const isSelected = item.id === selectedId;
                  const isPatientSearchItem = item.id === PATIENT_SEARCH_ITEM_ID;

                  return (
                    <ListItemButton
                      key={item.id}
                      data-item-id={item.id}
                      selected={isSelected}
                      onMouseEnter={() => setSelectedId(item.id)}
                      onClick={() => selectItem(item)}
                      sx={{
                        mx: 1,
                        borderRadius: 1,
                        py: 0.75,
                      }}
                    >
                      {isPatientSearchItem && (
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <PersonSearchIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        </ListItemIcon>
                      )}
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '14px',
                          ...(isPatientSearchItem ? { color: 'primary.main', fontWeight: 500 } : undefined),
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
