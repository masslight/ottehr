import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { ReactElement, ReactNode, useMemo, useState } from 'react';
import { IMMUNIZATION_OUTSIDE_SOURCES, IMMUNIZATION_SOURCE_UNSPECIFIED } from 'utils/lib/fhir/immunization';
import {
  EvaluatedDose,
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
  ImmunizationGroupStatus,
  ProjectedDoses,
} from 'utils/lib/immunization-forecast/types';
import {
  ImmunizationMark,
  ImmunizationMarkType,
  PatientImmunizationRecord,
} from 'utils/lib/types/data/immunization/types';
import {
  activeMark,
  ageInMonths,
  defaultRange,
  doseLabelMonths,
  formatAge,
  formatDate,
  givenDoseWindowSegments,
  lastProjectedMonths,
  markHistoryText,
  markRecordedText,
  nextDoseSegments,
  projectedDoseSegments,
  projectedDoseText,
  sameShotText,
  STATUS_LABELS,
  timelineRanges,
  TimelineSegment,
  timelineTicks,
  timingText,
  windowText,
  xPercent,
} from './timelineModel';

export interface ImmunizationTimelineProps {
  forecast: ImmunizationForecast;
  immunizations: PatientImmunizationRecord[];
  marks: ImmunizationMark[];
  /** ISO yyyy-mm-dd. */
  dob: string;
  /** A signed visit: no Mark or Clear controls. */
  readOnly: boolean;
  onMark: (group: ImmunizationGroupId, mark: ImmunizationMarkType, note?: string) => void;
  onClear: (markId: string) => void;
  /** A mark is being saved or cleared. */
  busy?: boolean;
  /** Later doses per group, if each is given on time: drawn in outline, display only. */
  projections?: ProjectedDoses;
}

const MARK_OPTIONS: { value: ImmunizationMarkType; label: string }[] = [
  { value: 'immune', label: 'Immune' },
  { value: 'contraindicated', label: 'Contraindicated' },
  { value: 'declined', label: 'Declined' },
];
const MARK_ICONS: Record<ImmunizationMarkType, string> = { immune: '✓', contraindicated: '⚠', declined: '⊘' };

const CHIP_COLORS: Record<ImmunizationGroupStatus, { bg: string; text: string; border?: string }> = {
  complete: { bg: '#C8E6C9', text: '#1B5E20' },
  uptodate: { bg: '#C8E6C9', text: '#1B5E20' },
  due: { bg: '#FFE0B2', text: '#5F2B00' },
  pastdue: { bg: '#FECDD2', text: '#B71C1C' },
  notyet: { bg: '#E6E8EE', text: '#616161' },
  notroutine: { bg: '#FFF', text: '#616161', border: '#E0E0E0' },
  declined: { bg: '#FFF', text: '#616161', border: '#BFC2C6' },
  contraindicated: { bg: '#FFF', text: '#B71C1C', border: '#EF9A9A' },
  immune: { bg: '#C8E6C9', text: '#1B5E20', border: '#A5D6A7' },
};

const NEXT_ORANGE = '#F0A04B';
const PROJECTED_GRAY = '#8A96A3';
const EARLIEST_STRIPES = 'repeating-linear-gradient(45deg, #A9B4C0 0 3px, #EEF1F4 3px 7px)';
const SEGMENT_STYLE: Record<
  TimelineSegment['kind'],
  { top: number; height: number; background: string; border?: string }
> = {
  earliest: { top: 11, height: 12, background: EARLIEST_STRIPES, border: '1px solid #A9B4C0' },
  recommended: { top: 11, height: 12, background: '#FFE0B2' },
  pastdue: { top: 11, height: 12, background: '#F8C9C9' },
  'window-earliest': { top: 13, height: 8, background: EARLIEST_STRIPES },
  'window-recommended': { top: 13, height: 8, background: '#E3EEDD' },
  'projected-earliest': { top: 11, height: 12, background: 'transparent', border: `1px dashed ${PROJECTED_GRAY}` },
  'projected-recommended': { top: 11, height: 12, background: 'transparent', border: `1.5px solid ${NEXT_ORANGE}` },
  'projected-pastdue': { top: 11, height: 12, background: 'transparent', border: '1.5px solid #E57373' },
};
const LATE_WINDOW_BACKGROUND = '#F3DADA';
const LABEL_WIDTH = 380;
/** Room left of age 0, so a birth dose's circle clears the lane's Mark button. */
const PLOT_INSET = 16;

type Selection =
  | { kind: 'dose'; group: ImmunizationGroupId; id: string }
  | { kind: 'next'; group: ImmunizationGroupId }
  | { kind: 'projected'; group: ImmunizationGroupId; n: number }
  | { kind: 'lane'; group: ImmunizationGroupId };

export const StatusChip = ({ status }: { status: ImmunizationGroupStatus }): ReactElement => {
  const colors = CHIP_COLORS[status];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        px: 1,
        borderRadius: '11px',
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        bgcolor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border ?? 'transparent'}`,
      }}
    >
      {STATUS_LABELS[status]}
    </Box>
  );
};

const Segment = ({
  segment,
  maxMonths,
  dim,
  onClick,
}: {
  segment: TimelineSegment;
  maxMonths: number;
  dim?: boolean;
  onClick?: () => void;
}): ReactElement => {
  const style = SEGMENT_STYLE[segment.kind];
  const left = xPercent(segment.from, maxMonths);
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={segment.title}
      aria-label={onClick ? segment.title : undefined}
      sx={{
        position: 'absolute',
        left: `${left}%`,
        width: `${xPercent(segment.to, maxMonths) - left}%`,
        top: style.top,
        height: style.height,
        borderRadius: style.height / 2,
        border: style.border ?? 0,
        boxSizing: 'border-box',
        p: 0,
        background: segment.late ? LATE_WINDOW_BACKGROUND : style.background,
        opacity: dim ? 0.45 : 1,
        cursor: onClick ? 'pointer' : 'default',
      }}
    />
  );
};

const Dose = ({
  dose,
  laneLabel,
  record,
  left,
  selected,
  details,
  onClick,
}: {
  dose: EvaluatedDose;
  laneLabel: string;
  record?: PatientImmunizationRecord;
  left: number;
  selected: boolean;
  /** The same details the box below shows when the dot is clicked. */
  details: ReactNode;
  onClick: () => void;
}): ReactElement => {
  const theme = useTheme();
  const outside = record?.outside ?? false;
  const late = dose.timing === 'late';
  const label = dose.counted ? `${laneLabel} dose ${dose.doseNumber}` : `${laneLabel} dose not counted`;
  return (
    <Tooltip title={details} placement="top">
      <ButtonBase
        onClick={onClick}
        aria-label={label}
        aria-pressed={selected}
        sx={{
          position: 'absolute',
          top: 7,
          left: `${left}%`,
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          fontSize: 10,
          fontWeight: 600,
          border: `2px ${outside ? 'dashed' : 'solid'} ${
            late ? theme.palette.error.main : dose.counted ? theme.palette.primary.dark : theme.palette.text.disabled
          }`,
          bgcolor: outside || !dose.counted ? '#fff' : theme.palette.primary.dark,
          color: outside ? theme.palette.primary.dark : dose.counted ? '#fff' : theme.palette.text.secondary,
          boxShadow: selected ? `0 0 0 3px ${theme.palette.primary.light}` : 'none',
          zIndex: 2,
        }}
      >
        {dose.counted ? dose.doseNumber : '–'}
      </ButtonBase>
    </Tooltip>
  );
};

/** The number of a dose still to come, at the start of its bar's recommended part: a hollow circle the size of a
 * given-dose dot with a dashed gray outline (next and projected doses alike), drawn above the bars. */
const DoseNumber = ({
  n,
  label,
  details,
  left,
  dim,
  onClick,
}: {
  n: number;
  label: string;
  /** The same details the box below shows when the circle is clicked. */
  details: ReactNode;
  left: number;
  dim?: boolean;
  onClick: () => void;
}): ReactElement => (
  <Tooltip title={details} placement="top">
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      sx={{
        position: 'absolute',
        top: 7,
        left: `${left}%`,
        transform: 'translateX(-50%)',
        width: 20,
        height: 20,
        borderRadius: '50%',
        fontSize: 10,
        fontWeight: 600,
        boxSizing: 'border-box',
        border: `2px dashed ${PROJECTED_GRAY}`,
        bgcolor: '#fff',
        color: PROJECTED_GRAY,
        opacity: dim ? 0.45 : 1,
        zIndex: 3,
      }}
    >
      {n}
    </ButtonBase>
  </Tooltip>
);

const sourceLabel = (record: PatientImmunizationRecord): string =>
  IMMUNIZATION_OUTSIDE_SOURCES.find((source) => source.value === record.source)?.label ??
  IMMUNIZATION_SOURCE_UNSPECIFIED.label;

const LegendSwatch = ({ sx, children }: { sx: object; children?: ReactNode }): ReactElement => (
  <Box component="i" sx={{ display: 'inline-block', width: 22, height: 10, borderRadius: 5, mr: 0.5, ...sx }}>
    {children}
  </Box>
);

export const ImmunizationTimeline = ({
  forecast,
  immunizations,
  marks,
  dob,
  readOnly,
  onMark,
  onClear,
  busy,
  projections,
}: ImmunizationTimelineProps): ReactElement => {
  const theme = useTheme();
  const todayMonths = ageInMonths(dob, forecast.asOf);
  const ranges = useMemo(() => timelineRanges(todayMonths), [todayMonths]);
  const [maxMonths, setMaxMonths] = useState(
    () => defaultRange(todayMonths, ranges, lastProjectedMonths(projections, dob)).maxMonths
  );
  const [showWindows, setShowWindows] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [menu, setMenu] = useState<{ group: ImmunizationGroupForecast; anchor: HTMLElement } | null>(null);
  const [dialog, setDialog] = useState<{ group: ImmunizationGroupForecast; mark: ImmunizationMarkType } | null>(null);
  const [note, setNote] = useState('');

  const ticks = useMemo(() => timelineTicks(maxMonths), [maxMonths]);
  const recordsById = useMemo(() => new Map(immunizations.map((record) => [record.id, record])), [immunizations]);
  const x = (months: number): number => xPercent(months, maxMonths);
  const todayVisible = todayMonths <= maxMonths;

  const openDialog = (mark: ImmunizationMarkType): void => {
    if (!menu) return;
    setDialog({ group: menu.group, mark });
    setNote('');
    setMenu(null);
  };
  const saveMark = (): void => {
    if (!dialog) return;
    onMark(dialog.group.group, dialog.mark, note.trim() || undefined);
    setDialog(null);
  };

  /** What the details box shows for a selection; also the hover of the dose dots and dose-number circles. */
  const detailsFor = (selection: Selection | null): ReactNode => {
    if (!selection) return <Typography variant="body2">Click a dose, bar or marker for details.</Typography>;
    const group = forecast.groups.find((candidate) => candidate.group === selection.group);
    if (!group) return null;
    if (selection.kind === 'dose') {
      const dose = group.doses.find((candidate) => candidate.id === selection.id);
      const record = recordsById.get(selection.id);
      if (!dose) return null;
      const same = sameShotText(forecast, dose.id, group.group);
      return (
        <Typography variant="body2" component="div">
          <b>
            {group.label} {dose.counted ? `dose ${dose.doseNumber}` : '(not counted)'}
          </b>
          {' · '}
          {dose.date ? `${formatDate(dose.date)} (${formatAge(ageInMonths(dob, dose.date))})` : 'Date unknown'}
          {record?.vaccineName && ` · ${record.vaccineName}`}
          {dose.cvx && `, CVX ${dose.cvx}`}
          {!dose.counted && dose.reason && (
            <>
              <br />
              {dose.reason}
            </>
          )}
          {dose.window && (
            <>
              <br />
              Due window: {windowText(dose.window)}. {timingText(dose)}.
            </>
          )}
          {same && (
            <>
              <br />
              Same shot also counts as: {same}
            </>
          )}
          <br />
          <Typography variant="caption" color="text.secondary">
            {record?.outside
              ? `Outside${record.place ? ` · at ${record.place}` : ''} · from ${sourceLabel(record)}`
              : `Given here${record?.lot ? `, lot ${record.lot}` : ''}${
                  record?.administeredBy?.name ? `, by ${record.administeredBy.name}` : ''
                }`}
          </Typography>
        </Typography>
      );
    }
    if (selection.kind === 'projected') {
      const projected = projections?.[group.group]?.find((candidate) => candidate.n === selection.n);
      return projected ? <Typography variant="body2">{projectedDoseText(group.label, projected)}</Typography> : null;
    }
    const history = markHistoryText(marks, group.group);
    if (selection.kind === 'lane' || !group.next) {
      return (
        <Typography variant="body2" component="div">
          <b>{group.label}</b> · <StatusChip status={group.status} /> · Target: {group.targetText}
          {group.notes.length > 0 && (
            <>
              <br />
              {group.notes.join(' ')}
            </>
          )}
          {history && (
            <>
              <br />
              Exceptions: {history}
            </>
          )}
        </Typography>
      );
    }
    const next = group.next;
    return (
      <Typography variant="body2" component="div">
        <b>
          {group.label} dose {next.n}
        </b>{' '}
        · <StatusChip status={group.status} />
        <br />
        Earliest: {formatDate(next.earliest)} · Recommended: {formatDate(next.recommended)} · Past due:{' '}
        {next.pastDue ? formatDate(next.pastDue) : '—'}
        {next.note && (
          <>
            <br />
            <Typography variant="caption" color="text.secondary">
              {next.note}
            </Typography>
          </>
        )}
      </Typography>
    );
  };

  const laneLabelSx = {
    width: LABEL_WIDTH,
    flex: 'none',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 136px 72px',
    alignItems: 'center',
    columnGap: 1,
    py: 0.25,
    pr: 1.25,
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={maxMonths}
          onChange={(_, value: number | null) => value && setMaxMonths(value)}
          aria-label="Age range"
        >
          {ranges.map((range) => (
            <ToggleButton key={range.maxMonths} value={range.maxMonths}>
              {range.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Checkbox size="small" checked={showWindows} onChange={(e) => setShowWindows(e.target.checked)} />}
          label={<Typography variant="body2">Show windows for given doses</Typography>}
        />
        <Typography variant="caption" color="text.secondary">
          Age axis is stretched for infancy, where most doses are.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ px: 2, pt: 1, pb: 1.5 }}>
        <Box sx={{ display: 'flex' }}>
          <Box sx={laneLabelSx} />
          <Box sx={{ flex: 1, position: 'relative', height: 40, ml: `${PLOT_INSET}px` }}>
            {ticks.map((tick) => (
              <Typography
                key={tick.months}
                variant="caption"
                color="text.secondary"
                sx={{ position: 'absolute', top: 18, left: `${x(tick.months)}%`, transform: 'translateX(-50%)' }}
              >
                {tick.label}
              </Typography>
            ))}
            {todayVisible && (
              <Typography
                variant="caption"
                color="primary"
                sx={{
                  // above the age scale, so it hides no tick label
                  position: 'absolute',
                  top: 0,
                  left: `${x(todayMonths)}%`,
                  transform: 'translateX(-50%)',
                  fontWeight: 600,
                  bgcolor: '#fff',
                  px: 0.5,
                }}
              >
                Today
              </Typography>
            )}
          </Box>
        </Box>

        {forecast.groups.map((group) => {
          const mark = activeMark(marks, group.group);
          const dim = group.status === 'declined';
          const nextSegments = nextDoseSegments(group, dob, forecast.asOf, maxMonths);
          const nextLabelAt = doseLabelMonths(nextSegments);
          const laterDoses = (projections?.[group.group] ?? []).map((projected) => {
            const segments = projectedDoseSegments(projected, group.label, dob, maxMonths);
            return { projected, segments, labelAt: doseLabelMonths(segments) };
          });
          const undated = group.doses.find((dose) => !dose.date);
          return (
            <Box
              key={group.group}
              sx={{ display: 'flex', alignItems: 'stretch', minHeight: 36 }}
              data-testid={`immunization-lane-${group.group}`}
            >
              <Box sx={laneLabelSx}>
                <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <ButtonBase
                    onClick={() => setSelection({ kind: 'lane', group: group.group })}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 13, fontWeight: 500 }}
                  >
                    {group.label}
                  </ButtonBase>
                  {mark && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {markRecordedText(mark)}
                    </Typography>
                  )}
                </Box>
                <Box>
                  <StatusChip status={group.status} />
                </Box>
                <Box>
                  {!readOnly &&
                    (mark ? (
                      <Button size="small" disabled={busy} onClick={() => onClear(mark.id)}>
                        Clear
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        disabled={busy}
                        endIcon={<ArrowDropDownIcon />}
                        aria-haspopup="menu"
                        aria-label={`Exception for ${group.label}`}
                        onClick={(event) => setMenu({ group, anchor: event.currentTarget })}
                      >
                        Exception
                      </Button>
                    ))}
                </Box>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  position: 'relative',
                  ml: `${PLOT_INSET}px`,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                }}
              >
                {ticks.map((tick) => (
                  <Box
                    key={tick.months}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: 1,
                      left: `${x(tick.months)}%`,
                      bgcolor: '#F4F6F8',
                    }}
                  />
                ))}
                {todayVisible && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: 2,
                      left: `${x(todayMonths)}%`,
                      bgcolor: theme.palette.primary.main,
                      opacity: 0.5,
                    }}
                  />
                )}
                {nextSegments.map((segment) => (
                  <Segment
                    key={segment.kind}
                    segment={segment}
                    maxMonths={maxMonths}
                    dim={dim}
                    onClick={() => setSelection({ kind: 'next', group: group.group })}
                  />
                ))}
                {laterDoses.flatMap(({ projected, segments }) =>
                  segments.map((segment) => (
                    <Segment
                      key={`projected-${projected.n}-${segment.kind}`}
                      segment={segment}
                      maxMonths={maxMonths}
                      dim={dim}
                      onClick={() => setSelection({ kind: 'projected', group: group.group, n: projected.n })}
                    />
                  ))
                )}
                {showWindows &&
                  group.doses.flatMap((dose) =>
                    givenDoseWindowSegments(dose, dob, maxMonths, group.label).map((segment) => (
                      <Segment key={`${dose.id}-${segment.kind}`} segment={segment} maxMonths={maxMonths} />
                    ))
                  )}
                {group.doses
                  .filter((dose) => dose.date && ageInMonths(dob, dose.date) <= maxMonths)
                  .map((dose) => (
                    <Dose
                      key={dose.id}
                      dose={dose}
                      laneLabel={group.label}
                      record={recordsById.get(dose.id)}
                      left={x(ageInMonths(dob, dose.date!))}
                      selected={selection?.kind === 'dose' && selection.id === dose.id}
                      details={detailsFor({ kind: 'dose', group: group.group, id: dose.id })}
                      onClick={() => setSelection({ kind: 'dose', group: group.group, id: dose.id })}
                    />
                  ))}
                {group.next && nextLabelAt !== null && (
                  <DoseNumber
                    n={group.next.n}
                    label={`${group.label} dose ${group.next.n} (next)`}
                    details={detailsFor({ kind: 'next', group: group.group })}
                    left={x(nextLabelAt)}
                    dim={dim}
                    onClick={() => setSelection({ kind: 'next', group: group.group })}
                  />
                )}
                {laterDoses.map(({ projected, labelAt }) =>
                  labelAt === null ? null : (
                    <DoseNumber
                      key={`projected-${projected.n}-number`}
                      n={projected.n}
                      label={`${group.label} dose ${projected.n} (projected)`}
                      details={detailsFor({ kind: 'projected', group: group.group, n: projected.n })}
                      left={x(labelAt)}
                      dim={dim}
                      onClick={() => setSelection({ kind: 'projected', group: group.group, n: projected.n })}
                    />
                  )
                )}
                {undated && (
                  <ButtonBase
                    onClick={() => setSelection({ kind: 'dose', group: group.group, id: undated.id })}
                    sx={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 11,
                      color: 'text.secondary',
                      bgcolor: '#fff',
                      px: 0.5,
                    }}
                  >
                    Outside · Date unknown · not counted
                  </ButtonBase>
                )}
                {mark && (
                  <ButtonBase
                    onClick={() => setSelection({ kind: 'lane', group: group.group })}
                    title={markHistoryText(marks, group.group)}
                    aria-label={`${group.label} exception`}
                    sx={{
                      position: 'absolute',
                      top: 7,
                      left: `${x(ageInMonths(dob, mark.markedAt))}%`,
                      transform: 'translateX(-50%)',
                      width: 20,
                      height: 20,
                      borderRadius: 1,
                      fontSize: 13,
                      fontWeight: 700,
                      bgcolor: '#fff',
                      border: `1px solid ${mark.mark === 'contraindicated' ? '#EF9A9A' : '#BFC2C6'}`,
                      color: mark.mark === 'contraindicated' ? theme.palette.error.main : theme.palette.text.secondary,
                      zIndex: 2,
                    }}
                  >
                    {MARK_ICONS[mark.mark]}
                  </ButtonBase>
                )}
              </Box>
            </Box>
          );
        })}

        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} sx={{ mt: 1.25, alignItems: 'center' }}>
          {[
            [
              <LegendSwatch
                key="g"
                sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: theme.palette.primary.dark }}
              />,
              'Given here',
            ],
            [
              <LegendSwatch
                key="o"
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  border: `2px dashed ${theme.palette.primary.dark}`,
                }}
              />,
              'Outside',
            ],
            [
              <LegendSwatch
                key="e"
                sx={{
                  background: SEGMENT_STYLE.earliest.background,
                  border: SEGMENT_STYLE.earliest.border,
                  boxSizing: 'border-box',
                }}
              />,
              'Allowed but early',
            ],
            [<LegendSwatch key="r" sx={{ background: SEGMENT_STYLE.recommended.background }} />, 'Recommended'],
            [<LegendSwatch key="p" sx={{ background: SEGMENT_STYLE.pastdue.background }} />, 'Past due'],
            ...(projections && Object.keys(projections).length
              ? [
                  [
                    <LegendSwatch
                      key="l"
                      sx={{ border: SEGMENT_STYLE['projected-recommended'].border, boxSizing: 'border-box' }}
                    />,
                    'Later doses (if each is given on time)',
                  ],
                ]
              : []),
            ...(showWindows
              ? [
                  [
                    <LegendSwatch key="w" sx={{ background: SEGMENT_STYLE['window-recommended'].background }} />,
                    'Window a given dose was due in',
                  ],
                ]
              : []),
            [<span key="d">{MARK_ICONS.declined}</span>, 'Declined'],
            [
              <span key="c" style={{ color: theme.palette.error.main }}>
                {MARK_ICONS.contraindicated}
              </span>,
              'Contraindicated',
            ],
            [<span key="i">{MARK_ICONS.immune}</span>, 'Immune'],
          ].map(([swatch, label]) => (
            <Typography
              key={String(label)}
              variant="caption"
              color="text.secondary"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              {swatch} {label}
            </Typography>
          ))}
        </Stack>

        <Box
          aria-live="polite"
          data-testid="immunization-timeline-details"
          sx={{
            mt: 1.25,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            px: 1.75,
            py: 1.25,
            bgcolor: '#F4F6F8',
            minHeight: 44,
          }}
        >
          {detailsFor(selection)}
        </Box>
      </Paper>

      <Menu open={menu !== null} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        {MARK_OPTIONS.map((option) => (
          <MenuItem key={option.value} onClick={() => openDialog(option.value)}>
            {option.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="xs">
        {dialog && (
          <>
            <DialogTitle>
              {dialog.group.label} exception: {MARK_OPTIONS.find((option) => option.value === dialog.mark)?.label}
            </DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={2}
                label="Note (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                sx={{ mt: 1 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button variant="contained" onClick={saveMark}>
                Save
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
};
