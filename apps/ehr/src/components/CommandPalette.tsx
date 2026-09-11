import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Dialog,
  IconButton,
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
import { getInsertTarget } from '../helpers/insertTextAtCaret';
import { shortcutLabel } from '../helpers/keyboardShortcut';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';

const PATIENT_SEARCH_ITEM_ID = '__patient-search__';

// Pinned group order: "Actions" first, "Phrases" directly below it; every other
// group keeps its alphabetical order after those two.
const CATEGORY_RANK: Record<string, number> = { Actions: 0, Phrases: 1 };
const categoryRank = (category: string): number => CATEGORY_RANK[category] ?? Object.keys(CATEGORY_RANK).length;
const compareCategories = (left: string, right: string): number =>
  categoryRank(left) - categoryRank(right) || left.localeCompare(right);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sortItems = (items: CommandPaletteItem[], query = ''): CommandPaletteItem[] => {
  // Build a quick id → item lookup so children can be sorted by their parent's
  // label rather than their own (which would scatter them throughout the list
  // and break the visual hierarchy that parentId implies).
  const itemsById = new Map(items.map((item) => [item.id, item]));
  // For each item, compute its sort group:
  //   - parents (and items with no parentId) sort by their own label
  //   - children sort by parent's label, then by a fixed "childOrder" so
  //     siblings keep their author-declared order (preserves the natural
  //     "Pre-booked / Active / Discharged / Cancelled" order rather than
  //     alphabetizing within the group).
  const childOrderById = new Map<string, number>();
  let childIdx = 0;
  for (const item of items) {
    if (item.parentId) childOrderById.set(item.id, childIdx++);
  }
  const sortKeyFor = (item: CommandPaletteItem): { primary: string; isChild: boolean; secondary: number } => {
    if (item.parentId) {
      const parent = itemsById.get(item.parentId);
      return {
        primary: (parent?.label ?? item.label).toLowerCase(),
        isChild: true,
        secondary: childOrderById.get(item.id) ?? 0,
      };
    }
    return { primary: item.label.toLowerCase(), isChild: false, secondary: 0 };
  };

  // When the user has typed a query, items whose LABEL contains it rank above
  // items whose match comes only from keyword/category. Both stay visible, but
  // label matches are obviously more relevant — typing "schedul" should put
  // "Schedules" above items that only match because they keyword "fee schedule"
  // or "scheduled".
  const normalizedQuery = query.trim().toLowerCase();
  const matchPriority = (item: CommandPaletteItem): number => {
    if (!normalizedQuery) return 0;
    if (item.label.toLowerCase().includes(normalizedQuery)) return 0;
    return 1; // category or keyword match (still visible, just lower priority)
  };

  return [...items].sort((left, right) => {
    const categoryComparison = compareCategories(left.category, right.category);
    if (categoryComparison !== 0) return categoryComparison;
    const priorityComparison = matchPriority(left) - matchPriority(right);
    if (priorityComparison !== 0) return priorityComparison;
    const lk = sortKeyFor(left);
    const rk = sortKeyFor(right);
    const primaryComparison = lk.primary.localeCompare(rk.primary);
    if (primaryComparison !== 0) return primaryComparison;
    // Same parent label: parent first, then children in author-declared order.
    if (lk.isChild !== rk.isChild) return lk.isChild ? 1 : -1;
    return lk.secondary - rk.secondary;
  });
};

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
  const openWithInsertTarget = useCommandPaletteStore((state) => state.openWithInsertTarget);
  const close = useCommandPaletteStore((state) => state.close);
  const sources = useCommandPaletteStore((state) => state.sources);
  const groupActions = useCommandPaletteStore((state) => state.groupActions);
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

    return [...uniqueItems.values()];
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
    // Sort happens here (post-filter) so that children whose parent has been
    // filtered out fall back to sorting by their own label rather than getting
    // stranded near where the parent used to sit. sortItems also handles
    // grouping children directly under their (visible) parent.
    if (filteredItems.length > 0 || !query.trim()) {
      return sortItems(filteredItems, query);
    }

    return [
      {
        id: PATIENT_SEARCH_ITEM_ID,
        label: `Search patients for "${query.trim()}"`,
        category: 'Search',
        icon: <PersonSearchIcon fontSize="small" sx={{ color: 'primary.main' }} />,
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

    if (query.trim()) {
      return [...groups.entries()];
    }

    // With no query, a group that has a header action but no items still shows
    // its header so the action stays reachable (e.g. creating the first phrase).
    Object.keys(groupActions).forEach((category) => {
      if (!groups.has(category)) groups.set(category, []);
    });

    return [...groups.entries()].sort(([left], [right]) => compareCategories(left, right));
  }, [displayItems, groupActions, query]);

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
        event.preventDefault();
        if (isOpen) {
          close();
          return;
        }
        // Opened from a text field: remember it so phrases can insert into it.
        openWithInsertTarget(getInsertTarget(document.activeElement));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, isOpen, openWithInsertTarget]);

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
                  {shortcutLabel('K')}
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
          {groupedItems.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Type to search actions and pages</Typography>
            </Box>
          ) : (
            groupedItems.map(([category, items]) => {
              // Only treat an item as visually-indented child if its parent is
              // present in the SAME visible group. When the parent has been
              // filtered out, the child shows as a top-level entry — otherwise
              // it would render indented under whatever item happened to sort
              // immediately above it, which is misleading.
              const visibleIdsInGroup = new Set(items.map((it) => it.id));
              const groupAction = groupActions[category];
              return (
                <Box key={category}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 0.5,
                      // Rows are inset mx:1 + ListItemButton px:2, so px:3 lines the "+" up with the row-action column.
                      px: 3,
                      py: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: '11px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {category}
                    </Typography>
                    {groupAction && (
                      <IconButton
                        size="small"
                        // Keeps arrow keys/Enter on the rows: the button never takes focus.
                        tabIndex={-1}
                        aria-label={groupAction.label}
                        title={groupAction.label}
                        sx={{ color: 'text.secondary', '&:hover': { color: groupAction.color ?? 'primary.main' } }}
                        onClick={() => {
                          groupAction.onClick();
                          close();
                        }}
                      >
                        {groupAction.icon}
                      </IconButton>
                    )}
                  </Box>

                  {items.map((item) => {
                    const isSelected = item.id === selectedId;
                    const isPatientSearchItem = item.id === PATIENT_SEARCH_ITEM_ID;
                    const isChild = !!item.parentId && visibleIdsInGroup.has(item.parentId);

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
                          ...(isChild ? { pl: 4 } : undefined),
                        }}
                      >
                        {item.icon && <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>}
                        <ListItemText
                          primary={
                            item.inlineDescription && item.description ? (
                              <>
                                {item.label}{' '}
                                <Typography component="span" sx={{ color: 'text.secondary', fontSize: '13px' }}>
                                  ({item.description})
                                </Typography>
                              </>
                            ) : (
                              item.label
                            )
                          }
                          secondary={item.inlineDescription ? undefined : item.description}
                          secondaryTypographyProps={{ noWrap: true, fontSize: '12px' }}
                          primaryTypographyProps={{
                            noWrap: !!item.inlineDescription,
                            fontSize: isChild ? '13px' : '14px',
                            color: isChild ? 'text.secondary' : undefined,
                            ...(isPatientSearchItem ? { color: 'primary.main', fontWeight: 500 } : undefined),
                          }}
                        />
                        {item.actions && item.actions.length > 0 && (
                          <Box className="palette-row-actions" sx={{ display: 'flex', flexShrink: 0 }}>
                            {item.actions.map((action) => (
                              <IconButton
                                key={action.id}
                                size="small"
                                aria-label={action.label}
                                title={action.label}
                                sx={{ color: 'text.secondary', '&:hover': { color: action.color ?? 'primary.main' } }}
                                onClick={(event) => {
                                  // Keep the row's selectItem from firing.
                                  event.stopPropagation();
                                  action.onClick();
                                  close();
                                }}
                              >
                                {action.icon}
                              </IconButton>
                            ))}
                          </Box>
                        )}
                      </ListItemButton>
                    );
                  })}
                </Box>
              );
            })
          )}
        </List>
      </Box>
    </Dialog>
  );
};
