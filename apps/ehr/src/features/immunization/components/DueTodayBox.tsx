import { AddCircleOutline, CheckCircle } from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { FC, ReactNode, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BASE_ROUTE_OPTIONS } from 'src/shared/utils/options';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import {
  Coverage,
  DueToday,
  DueTodayCandidate,
  isVaccineAdded,
  StockedVaccine,
  stockedVaccineName,
  vaccinesToAddAll,
} from './dueToday';
import { ImmunizationFormValues } from './immunizationLines';

// The look of the eRx suggestion boxes (SuggestedSentences, tinted).
const BOX_SX = { p: 1.5, border: '1px solid', borderColor: '#d6e0ec', borderRadius: 1, bgcolor: '#f3f6fa' } as const;
const ROW_SX = { display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.5 } as const;

/** "Give 0.5 mL intramuscular in the left thigh": what a quick pick fills in, in the sentence's words. */
export const quickPickSummary = (quickPick: ImmunizationQuickPickData): string =>
  [
    'Give',
    quickPick.dose && quickPick.units ? `${quickPick.dose} ${quickPick.units}` : undefined,
    quickPick.route
      ? BASE_ROUTE_OPTIONS.find((option) => option.code === quickPick.route)?.name ?? quickPick.route
      : '',
    quickPick.location?.name ? `in the ${quickPick.location.name}` : undefined,
  ]
    .filter(Boolean)
    .join(' ');

const AddButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <Tooltip title={label}>
    <IconButton size="small" aria-label={label} onClick={onClick} sx={{ padding: '2px' }} color="primary">
      <AddCircleOutline sx={{ fontSize: 16 }} />
    </IconButton>
  </Tooltip>
);

const Added: FC = () => <CheckCircle sx={{ fontSize: 16, color: 'success.main', m: '2px' }} titleAccess="Added" />;

const Caption: FC<{ children: ReactNode }> = ({ children }) => (
  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
    {children}
  </Typography>
);

/** The quick picks of a vaccine, each with its own ⊕: one click picks how the practice gives it. */
const QuickPickRows: FC<{
  quickPicks: ImmunizationQuickPickData[];
  onPick: (quickPick: ImmunizationQuickPickData) => void;
}> = ({ quickPicks, onPick }) => (
  <Box sx={{ pl: 2 }}>
    {quickPicks.map((quickPick, index) => (
      <Box key={quickPick.id ?? `${quickPick.name}-${index}`} sx={ROW_SX}>
        <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.8 }}>
          <Box component="span" sx={{ fontWeight: 500 }}>
            {quickPick.name}:
          </Box>{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            {quickPickSummary(quickPick)}
          </Typography>
        </Typography>
        <Box sx={{ mt: '2.6px', flex: 'none' }}>
          <AddButton label={`Add ${quickPick.name}`} onClick={() => onPick(quickPick)} />
        </Box>
      </Box>
    ))}
  </Box>
);

interface VaccineRowProps {
  candidate: DueTodayCandidate;
  labelOf: (groupId: string) => string;
  added: boolean;
  readOnly: boolean;
  onAdd: (vaccine: StockedVaccine, quickPick?: ImmunizationQuickPickData) => void;
  children?: ReactNode;
}

/** "Pentacel covers DTaP · Hib · Polio", with ⊕, ✓ Added, or (several quick picks) the picks under it. */
const VaccineRow: FC<VaccineRowProps> = ({ candidate, labelOf, added, readOnly, onAdd, children }) => {
  const { vaccine, covers, extras } = candidate;
  const several = vaccine.quickPicks.length > 1;
  return (
    <Box data-testid={dataTestIds.orderVaccinePage.dueTodayRow}>
      <Box sx={ROW_SX}>
        <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.8 }}>
          <Tooltip title={vaccine.outOfStock ? 'Out of stock' : ''} placement="top-start">
            <Box
              component="span"
              sx={vaccine.outOfStock ? { opacity: 0.5 } : undefined}
              aria-disabled={vaccine.outOfStock || undefined}
            >
              <Box component="span" sx={{ fontWeight: 500 }}>
                {stockedVaccineName(vaccine)}
              </Box>{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                covers {covers.map(labelOf).join(' · ')}
              </Typography>
              {extras.length > 0 && <Caption>also gives {extras.map(labelOf).join(' · ')} (not due)</Caption>}
            </Box>
          </Tooltip>
          {children}
        </Typography>
        <Box sx={{ mt: '2.6px', flex: 'none' }}>
          {added ? (
            <Added />
          ) : (
            !readOnly &&
            !several && <AddButton label={`Add ${stockedVaccineName(vaccine)}`} onClick={() => onAdd(vaccine)} />
          )}
        </Box>
      </Box>
      {several && !added && !readOnly && (
        <QuickPickRows quickPicks={vaccine.quickPicks} onPick={(quickPick) => onAdd(vaccine, quickPick)} />
      )}
    </Box>
  );
};

interface DueTodayBoxProps {
  dueToday: DueToday | undefined;
  loading: boolean;
  error: boolean;
  lines: ImmunizationFormValues[];
  readOnly: boolean;
  onAdd: (vaccine: StockedVaccine, quickPick?: ImmunizationQuickPickData) => void;
  onAddAll: () => void;
}

/** The Due today box (decision #8): one row per group of due diseases, fewest shots first. */
export const DueTodayBox: FC<DueTodayBoxProps> = ({ dueToday, loading, error, lines, readOnly, onAdd, onAddAll }) => {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const labelOf = (groupId: string): string => dueToday?.labels[groupId as keyof DueToday['labels']] ?? groupId;
  const canAddAll = dueToday ? vaccinesToAddAll(dueToday, lines).length > 0 : false;

  return (
    <Box sx={BOX_SX} data-testid={dataTestIds.orderVaccinePage.dueTodayBox}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Due today
          {dueToday && dueToday.rows.length > 0 && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1.5, fontWeight: 400 }}>
              fewest shots first
            </Typography>
          )}
        </Typography>
        {canAddAll && !readOnly && (
          <Button
            size="small"
            sx={{ textTransform: 'none', p: 0, minWidth: 0 }}
            onClick={onAddAll}
            data-testid={dataTestIds.orderVaccinePage.dueTodayAddAll}
          >
            Add all due
          </Button>
        )}
      </Box>

      {loading && <Caption>Checking what is due…</Caption>}
      {error && <Caption>The forecast is not available right now.</Caption>}
      {dueToday && dueToday.due.length === 0 && <Caption>Nothing due today.</Caption>}

      {dueToday?.rows.map((row, index) => {
        const alternativesOpen = Boolean(open[index]);
        return (
          <VaccineRow
            key={row.lead.vaccine.id}
            candidate={{ ...row.lead, covers: row.covers }}
            labelOf={labelOf}
            added={isVaccineAdded(row.lead.vaccine, lines)}
            readOnly={readOnly}
            onAdd={onAdd}
          >
            {row.alternatives.length > 0 && (
              <>
                <Button
                  size="small"
                  sx={{ display: 'block', textTransform: 'none', p: 0, minWidth: 0, fontSize: 12 }}
                  aria-expanded={alternativesOpen}
                  onClick={() => setOpen((current) => ({ ...current, [index]: !alternativesOpen }))}
                >
                  {alternativesOpen ? 'Hide other ways' : 'Other ways to cover this'}
                </Button>
                {alternativesOpen && (
                  <Box sx={{ pl: 1, borderLeft: '1px dashed #d6e0ec' }}>
                    {row.alternatives.map((alternative) => (
                      <VaccineRow
                        key={alternative.vaccine.id}
                        candidate={alternative}
                        labelOf={labelOf}
                        added={isVaccineAdded(alternative.vaccine, lines)}
                        readOnly={readOnly}
                        onAdd={onAdd}
                      />
                    ))}
                  </Box>
                )}
              </>
            )}
          </VaccineRow>
        );
      })}

      {dueToday?.unstocked.map((group) => (
        <Caption key={group.id}>No stocked vaccine with a CVX code covers {group.label}.</Caption>
      ))}
      {dueToday?.notSuggested.map((text) => <Caption key={text}>Not suggested: {text}</Caption>)}
      {dueToday && dueToday.upcoming.length > 0 && <Caption>{dueToday.upcoming.join(' · ')}</Caption>}
    </Box>
  );
};

/** The strip over the lines: each due disease needed, covered, or about to be given twice. */
export const CoverageStrip: FC<{ coverage: Coverage[] }> = ({ coverage }) => {
  if (!coverage.length) return null;
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
      aria-label="Coverage"
      data-testid={dataTestIds.orderVaccinePage.coverage}
    >
      {coverage.map(({ group, count }) => (
        <Chip
          key={group.id}
          size="small"
          variant="outlined"
          color={count === 0 ? 'warning' : count === 1 ? 'success' : 'error'}
          label={
            count === 0
              ? `${group.label} needed`
              : count === 1
              ? `${group.label} ✓`
              : `${group.label} ×${count} (twice)`
          }
        />
      ))}
    </Box>
  );
};

/** The quick-pick box on a line whose vaccine the practice gives several ways: it asks which (decision #8, option B). */
export const LineQuickPicks: FC<{
  vaccineName: string;
  quickPicks: ImmunizationQuickPickData[];
  onQuickPick: (quickPick: ImmunizationQuickPickData) => void;
}> = ({ vaccineName, quickPicks, onQuickPick }) => (
  <Box sx={{ ...BOX_SX, p: 1, mb: 1 }} data-testid={dataTestIds.orderVaccinePage.lineQuickPicks}>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>
      Quick picks for {vaccineName}
    </Typography>
    <QuickPickRows quickPicks={quickPicks} onPick={onQuickPick} />
  </Box>
);
