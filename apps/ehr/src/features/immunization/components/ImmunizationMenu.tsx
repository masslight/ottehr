import { Box, TextField, Typography, useTheme } from '@mui/material';
import { FC, KeyboardEvent, MouseEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Vaccine } from 'src/features/visits/in-person/hooks/useImmunization';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';

/** A pick in the line's immunization menu. */
type ImmunizationMenuPick =
  | { kind: 'quickPick'; quickPick: ImmunizationQuickPickData }
  | { kind: 'vaccine'; vaccine: Vaccine };

const MENU_HEADING_SX = { display: 'block', px: 2, pt: 1, pb: 0.5, fontWeight: 700, color: 'text.secondary' };
const MENU_LIST_SX = { listStyle: 'none', m: 0, p: 0 };

const MenuHeading: FC<{ id: string; children: ReactNode }> = ({ id, children }) => (
  <Typography id={id} variant="caption" sx={MENU_HEADING_SX}>
    {children}
  </Typography>
);

const MenuMessage: FC<{ children: ReactNode }> = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
    {children}
  </Typography>
);

/** The immunization blank's popup: twice the other blanks' width for the menu's two columns, within the screen. */
export const IMMUNIZATION_MENU_PAPER_SX = {
  width: 'min(680px, calc(100vw - 32px))',
  maxWidth: 'min(680px, calc(100vw - 32px))',
  maxHeight: 'min(440px, calc(100dvh - 32px))',
};

/** The line's immunization menu: the practice's quick picks in the left column, the vaccines on hand in the right,
 * both narrowed by what's typed (a quick pick by its name or its vaccine's). Focus stays in the field: Up/Down move
 * within a column, Left/Right (once a row is highlighted) between them, Enter picks. */
export const ImmunizationMenu: FC<{
  quickPicks: ImmunizationQuickPickData[];
  vaccines: Vaccine[] | undefined;
  vaccinesLoading: boolean;
  onQuickPick: (quickPick: ImmunizationQuickPickData) => void;
  onVaccine: (vaccine: Vaccine) => void;
}> = ({ quickPicks, vaccines, vaccinesLoading, onQuickPick, onVaccine }) => {
  const id = useId();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const typed = query.trim().toLowerCase();
  const quickPickPicks: ImmunizationMenuPick[] = quickPicks
    .filter((quickPick) =>
      [quickPick.name, quickPick.vaccine?.name].some((text) => text?.toLowerCase().includes(typed))
    )
    .map((quickPick) => ({ kind: 'quickPick', quickPick }));
  const vaccinePicks: ImmunizationMenuPick[] = (vaccines ?? [])
    .filter((vaccine) => vaccine.name.toLowerCase().includes(typed))
    .map((vaccine) => ({ kind: 'vaccine', vaccine }));
  const columns = [quickPickPicks, vaccinePicks];
  const [active, setActive] = useState<{ column: number; row: number }>();
  // A highlight the lists no longer reach is none.
  const highlighted = active && columns[active.column][active.row] ? active : undefined;
  const optionId = (column: number, row: number): string => `${id}-option-${column}-${row}`;
  const activeId = highlighted && optionId(highlighted.column, highlighted.row);
  // A row the keyboard moves to is scrolled into view within its column only. Never on hover: scrolling to a
  // half-shown hovered row moved the rows under the pointer, which hovered the next one, and so on (scrollIntoView
  // also scrolled the popup itself).
  const keyboardMoved = useRef(false);
  useEffect(() => {
    const row = activeId ? document.getElementById(activeId) : null;
    const column = row?.closest<HTMLElement>('[data-menu-column]');
    if (!row || !column || !keyboardMoved.current) return;
    keyboardMoved.current = false;
    const bottom = row.offsetTop + row.offsetHeight;
    if (row.offsetTop < column.scrollTop) column.scrollTop = row.offsetTop;
    else if (bottom > column.scrollTop + column.clientHeight) column.scrollTop = bottom - column.clientHeight;
  }, [activeId]);

  const choose = (pick: ImmunizationMenuPick): void => {
    if (pick.kind === 'quickPick') onQuickPick(pick.quickPick);
    else onVaccine(pick.vaccine);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const move = (column: number, row: number): void => {
      event.preventDefault();
      keyboardMoved.current = true;
      setActive({ column, row });
    };
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // The quick picks first; without any, the vaccines.
      const column = highlighted?.column ?? (quickPickPicks.length || !vaccinePicks.length ? 0 : 1);
      const count = columns[column].length;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (count) move(column, highlighted ? (highlighted.row + step + count) % count : step > 0 ? 0 : count - 1);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && highlighted) {
      // Until a row is highlighted, Left/Right move in the text.
      const column = event.key === 'ArrowLeft' ? 0 : 1;
      const count = columns[column].length;
      if (column !== highlighted.column && count) move(column, Math.min(highlighted.row, count - 1));
    } else if (event.key === 'Enter' && highlighted) {
      event.preventDefault();
      choose(columns[highlighted.column][highlighted.row]);
    }
  };

  const option = (pick: ImmunizationMenuPick, column: number, row: number): ReactNode => {
    const isActive = highlighted?.column === column && highlighted.row === row;
    return (
      <Box
        component="li"
        key={optionId(column, row)}
        id={optionId(column, row)}
        role="option"
        aria-selected={isActive}
        // The field keeps focus.
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        onMouseMove={() => {
          keyboardMoved.current = false;
          if (!isActive) setActive({ column, row });
        }}
        onClick={() => choose(pick)}
        sx={{ px: 2, py: 0.75, cursor: 'pointer', bgcolor: isActive ? 'action.hover' : undefined }}
      >
        {pick.kind === 'vaccine' ? (
          pick.vaccine.name
        ) : (
          // A quick pick shows only its name, which the practice words as it likes.
          <Box component="span" sx={{ fontStyle: 'italic' }}>
            {pick.quickPick.name}
          </Box>
        )}
      </Box>
    );
  };

  // Each column scrolls on its own (the rows' offsets measured from it); on a narrow screen the vaccines go under the
  // quick picks. A fixed height, not a maximum: one following the rows resized the popup as typing emptied and
  // refilled the columns.
  const columnSx = {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    height: 180,
    [theme.breakpoints.up('sm')]: { height: 300 },
    overflowY: 'auto',
  };
  return (
    <Box sx={{ pt: 0.5 }}>
      <TextField
        size="small"
        fullWidth
        label="Immunization"
        placeholder="Select a quick pick or type to search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(undefined);
        }}
        onKeyDown={onKeyDown}
        inputProps={{
          role: 'combobox',
          autoComplete: 'off',
          'aria-autocomplete': 'list',
          'aria-expanded': true,
          'aria-controls': `${id}-quick-picks ${id}-vaccines`,
          'aria-activedescendant': activeId,
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mt: 1 }}>
        <Box data-menu-column sx={columnSx}>
          <MenuHeading id={`${id}-quick-picks-heading`}>Quick picks</MenuHeading>
          <Box
            component="ul"
            id={`${id}-quick-picks`}
            role="listbox"
            aria-labelledby={`${id}-quick-picks-heading`}
            sx={MENU_LIST_SX}
          >
            {quickPickPicks.map((pick, row) => option(pick, 0, row))}
          </Box>
          {quickPickPicks.length === 0 && (
            <MenuMessage>{quickPicks.length ? 'No quick picks match' : 'No quick picks yet'}</MenuMessage>
          )}
        </Box>
        <Box
          data-menu-column
          sx={{ ...columnSx, borderLeft: { sm: 1 }, borderTop: { xs: 1, sm: 0 }, borderColor: 'divider' }}
        >
          <MenuHeading id={`${id}-vaccines-heading`}>Vaccines</MenuHeading>
          <Box
            component="ul"
            id={`${id}-vaccines`}
            role="listbox"
            aria-labelledby={`${id}-vaccines-heading`}
            sx={MENU_LIST_SX}
          >
            {vaccinePicks.map((pick, row) => option(pick, 1, row))}
          </Box>
          {vaccinesLoading ? (
            <MenuMessage>Loading vaccines…</MenuMessage>
          ) : (
            vaccinePicks.length === 0 && (
              <MenuMessage>{vaccines?.length ? 'No vaccines match' : 'No vaccines found'}</MenuMessage>
            )
          )}
        </Box>
      </Box>
    </Box>
  );
};
