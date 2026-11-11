import CheckIcon from '@mui/icons-material/Check';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListSubheader,
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
  formatDate,
  givenDoseWindowSegments,
  lastProjectedMonths,
  markHistoryText,
  markText,
  nextDoseSegments,
  projectedDoseSegments,
  STATUS_LABELS,
  timelineRanges,
  TimelineSegment,
  timelineTicks,
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
/** The lane's status icon: a 22px circle with a glyph (shapes and colors from the approved mockup). */
const ICON_GLYPHS = {
  check: <path d="M9.5 15.6 6 12.1l1.4-1.4 2.1 2.1 5.1-5.1 1.4 1.4z" fill="currentColor" />,
  clock: <path d="M12 7v5.2l3.4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  bang: <path d="M11 7h2v6h-2zm0 8h2v2h-2z" fill="currentColor" />,
  dash: <path d="M8 11h8v2H8z" fill="currentColor" />,
  block: <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  warn: (
    <path
      transform="translate(12 12) scale(.72) translate(-12 -12.5)"
      d="M12 6 5.5 17.5h13zM11.2 10h1.6v4h-1.6zm0 5h1.6v1.4h-1.6z"
      fill="currentColor"
      fillRule="evenodd"
    />
  ),
  shield: (
    <path
      transform="translate(12 12) scale(.8) translate(-12 -11.75)"
      d="M12 5.5 7 7.5v4c0 3 2.1 5.6 5 6.5 2.9-.9 5-3.5 5-6.5v-4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  ),
};
const STATUS_ICONS: Record<
  ImmunizationGroupStatus,
  { glyph: keyof typeof ICON_GLYPHS; fg: string; ring: string; fill: string; tip: string }
> = {
  uptodate: {
    glyph: 'check',
    fg: '#2E7D32',
    ring: '#2E7D32',
    fill: '#fff',
    tip: 'Up to date: the doses due so far are done; more come later.',
  },
  complete: { glyph: 'check', fg: '#fff', ring: '#2E7D32', fill: '#2E7D32', tip: 'Complete: the series is done.' },
  due: {
    glyph: 'clock',
    fg: '#fff',
    ring: '#E8A04A',
    fill: '#E8A04A',
    tip: 'Due today: the next dose is in its recommended period.',
  },
  pastdue: { glyph: 'bang', fg: '#fff', ring: '#D32F2F', fill: '#D32F2F', tip: 'Past due: the next dose is overdue.' },
  notyet: {
    glyph: 'clock',
    fg: '#9AA4AE',
    ring: '#9AA4AE',
    fill: '#fff',
    tip: 'Not yet due: the first or next dose is later.',
  },
  notroutine: {
    glyph: 'dash',
    fg: '#9AA4AE',
    ring: '#C5CCD3',
    fill: '#fff',
    tip: 'Not routine: aged out or not routinely recommended.',
  },
  declined: { glyph: 'block', fg: '#616161', ring: '#616161', fill: '#fff', tip: 'Declined' },
  contraindicated: { glyph: 'warn', fg: '#C62828', ring: '#C62828', fill: '#fff', tip: 'Contraindicated' },
  immune: { glyph: 'shield', fg: '#2E7D32', ring: '#2E7D32', fill: '#fff', tip: 'Immune' },
};
const ICON_SIZE = 22;
/** The key's order: the statuses as a series moves through them, then the rest, then the exceptions. */
const ICON_KEY: ImmunizationGroupStatus[] = [
  'notyet',
  'due',
  'pastdue',
  'uptodate',
  'complete',
  'notroutine',
  'declined',
  'contraindicated',
  'immune',
];

const StatusIcon = ({ status }: { status: ImmunizationGroupStatus }): ReactElement => {
  const icon = STATUS_ICONS[status];
  return (
    <svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="12" cy="12" r="10" fill={icon.fill} stroke={icon.ring} strokeWidth="1.6" />
      <g style={{ color: icon.fg }}>{ICON_GLYPHS[icon.glyph]}</g>
    </svg>
  );
};

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
/** A dose not given yet (next or projected): a dashed circle, darker than the outline bars so its number reads. */
const FUTURE_CIRCLE_BORDER = '#7A8794';
const FUTURE_CIRCLE_TEXT = '#4A5561';
/** A dose given outside: filled like one given here, in a light navy tint. */
const OUTSIDE_FILL = '#A9BCD9';
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
};
const LATE_WINDOW_BACKGROUND = '#F3DADA';
/** The frozen left column: status icon + vaccine name. */
const LABEL_WIDTH = 170;
/** The plot's minimum width: a base plus some per year of the range, so long ranges scroll instead of squeezing. */
const PLOT_MIN_WIDTH = 480;
const PLOT_WIDTH_PER_YEAR = 24;
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
    <Tooltip followCursor title={segment.tip}>
      <Box
        component={onClick ? 'button' : 'span'}
        type={onClick ? 'button' : undefined}
        onClick={onClick}
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
    </Tooltip>
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
          // filled = given (navy here, light blue outside); a not-counted dose is a gray outline
          border: `2px solid ${
            late
              ? theme.palette.error.main
              : !dose.counted
              ? theme.palette.text.disabled
              : outside
              ? OUTSIDE_FILL
              : theme.palette.primary.dark
          }`,
          bgcolor: !dose.counted ? '#fff' : outside ? OUTSIDE_FILL : theme.palette.primary.dark,
          color: !dose.counted ? theme.palette.text.secondary : outside ? theme.palette.primary.dark : '#fff',
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
        border: `2px dashed ${FUTURE_CIRCLE_BORDER}`,
        bgcolor: '#fff',
        color: FUTURE_CIRCLE_TEXT,
        opacity: dim ? 0.45 : 1,
        zIndex: 3,
      }}
    >
      {n}
    </ButtonBase>
  </Tooltip>
);

/**
 * The lane's status, or its exception when one is set, as an icon left of the vaccine name. Clicking it opens the
 * exception menu; Complete (and a read-only timeline) shows a plain icon.
 */
const LaneStatusIcon = ({
  group,
  mark,
  clickable,
  busy,
  onClick,
}: {
  group: ImmunizationGroupForecast;
  mark: ImmunizationMark | undefined;
  clickable: boolean;
  busy?: boolean;
  onClick: (anchor: HTMLElement) => void;
}): ReactElement => {
  const shown = mark?.mark ?? group.status;
  const what = mark ? markText(mark) : STATUS_ICONS[shown].tip;
  const tip = clickable
    ? `${what}${mark ? '.' : ''} ${mark ? 'Click to change or clear.' : 'Click to add an exception.'}`
    : what;
  return (
    <Tooltip title={tip} placement="top">
      {clickable ? (
        <ButtonBase
          aria-label={`Exception for ${group.label}`}
          aria-haspopup="menu"
          disabled={busy}
          onClick={(event) => onClick(event.currentTarget)}
          sx={{ flex: 'none', borderRadius: '50%', '&.Mui-focusVisible': { outline: '2px solid #2169F5' } }}
        >
          <StatusIcon status={shown} />
        </ButtonBase>
      ) : (
        <Box component="span" role="img" tabIndex={0} aria-label={`${group.label}: ${what}`} sx={{ flex: 'none' }}>
          <StatusIcon status={shown} />
        </Box>
      )}
    </Tooltip>
  );
};

/** "Hep B dose 1 · Engerix-B · given 07/10/2026 (outside, late)": brand when known; a note only when it matters. */
const givenDoseText = (laneLabel: string, dose: EvaluatedDose, record?: PatientImmunizationRecord): string => {
  const notes = [
    record?.outside && 'outside',
    dose.counted && dose.timing === 'late' && 'late',
    !dose.counted && 'not counted',
  ].filter(Boolean);
  return [
    `${laneLabel} dose${dose.counted && dose.doseNumber ? ` ${dose.doseNumber}` : ''}`,
    record?.vaccineName,
    `given ${dose.date ? formatDate(dose.date) : 'date unknown'}${notes.length ? ` (${notes.join(', ')})` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');
};

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
      return <Typography variant="body2">{givenDoseText(group.label, dose, record)}</Typography>;
    }
    if (selection.kind === 'projected') {
      const projected = projections?.[group.group]?.find((candidate) => candidate.n === selection.n);
      return projected ? (
        <Typography variant="body2">
          {group.label} dose {projected.n} · projected {formatDate(projected.recommended)}
        </Typography>
      ) : null;
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
    return (
      <Typography variant="body2">
        {group.label} dose {group.next.n} · due {formatDate(group.next.recommended)}
      </Typography>
    );
  };

  // Frozen like a spreadsheet's first column: stays put, opaque and above the bars, while the plot scrolls sideways.
  const laneLabelSx = {
    width: LABEL_WIDTH,
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 0.25,
    pr: 1,
    position: 'sticky',
    left: 0,
    zIndex: 4,
    bgcolor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
  } as const;
  const menuMark = menu ? activeMark(marks, menu.group.group) : undefined;

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
      </Stack>

      <Paper variant="outlined" sx={{ px: 2, pt: 1, pb: 1.5 }}>
        <Box sx={{ overflowX: 'auto' }} data-testid="immunization-timeline-scroll">
          <Box sx={{ minWidth: LABEL_WIDTH + PLOT_INSET + PLOT_MIN_WIDTH + (PLOT_WIDTH_PER_YEAR * maxMonths) / 12 }}>
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
                    <LaneStatusIcon
                      group={group}
                      mark={mark}
                      clickable={!readOnly && group.status !== 'complete'}
                      busy={busy}
                      onClick={(anchor) => setMenu({ group, anchor })}
                    />
                    <ButtonBase
                      onClick={() => setSelection({ kind: 'lane', group: group.group })}
                      sx={{
                        minWidth: 0,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {group.label}
                    </ButtonBase>
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
                    {group.doses.flatMap((dose) =>
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
                          top: 6,
                          left: `${x(ageInMonths(dob, mark.markedAt))}%`,
                          transform: 'translateX(-50%)',
                          borderRadius: '50%',
                          zIndex: 2,
                        }}
                      >
                        <StatusIcon status={mark.mark} />
                      </ButtonBase>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} sx={{ mt: 1.25, alignItems: 'center' }}>
          {[
            [
              <LegendSwatch key="w" sx={{ background: SEGMENT_STYLE['window-recommended'].background }} />,
              'When it was due',
            ],
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
                sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: OUTSIDE_FILL, boxSizing: 'border-box' }}
              />,
              'Outside',
            ],
            [
              <LegendSwatch
                key="n"
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  border: `2px dashed ${FUTURE_CIRCLE_BORDER}`,
                  boxSizing: 'border-box',
                }}
              />,
              'Not given yet',
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

        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={2}
          sx={{ mt: 0.75, alignItems: 'center' }}
          data-testid="immunization-status-key"
        >
          {ICON_KEY.map((status) => (
            <Typography
              key={status}
              variant="caption"
              color="text.secondary"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <StatusIcon status={status} /> {STATUS_LABELS[status]}
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
        <ListSubheader sx={{ lineHeight: '28px' }}>Exception</ListSubheader>
        {MARK_OPTIONS.map((option) => (
          <MenuItem key={option.value} onClick={() => openDialog(option.value)}>
            <ListItemIcon>
              {menuMark?.mark === option.value && <CheckIcon fontSize="small" color="primary" />}
            </ListItemIcon>
            {option.label}
          </MenuItem>
        ))}
        {menuMark && <Divider />}
        {menuMark && (
          <MenuItem
            onClick={() => {
              onClear(menuMark.id);
              setMenu(null);
            }}
          >
            <ListItemIcon />
            Clear
          </MenuItem>
        )}
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
