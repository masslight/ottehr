import {
  Add as AddIcon,
  ArrowForward as YesIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  KeyboardArrowDown as CaretIcon,
  SouthEast as NoIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
import { ReactElement, ReactNode } from 'react';
import { RuleCondition, RuleConditional, RuleOutcome } from 'utils';
import {
  ActionFields,
  ConditionTypeSelect,
  describeAction,
  describeFieldCondition,
  FieldConditionFields,
  LogicSelect,
  newAction,
  newBranch,
  newFieldCondition,
  newOutcome,
  OutcomeTypeSelect,
  PopoverEditable,
} from './shared';

// ---------------------------------------------------------------------------
// Variant C — "Flow"
//
// Draws the rule as the decision flowchart the engine actually walks: each branch is a test with a
// YES path into its outcome and a NO path that drops to the next test, ending at a terminal "claim
// submitted" node. This makes the *control flow* — what happens when a condition fails, where an
// else falls through — explicit, which the stacked-form and outline views only imply. Editing is
// the same click-a-chip-to-open-a-form interaction shared across the variants.
// ---------------------------------------------------------------------------

const chipSx: SxProps<Theme> = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  borderRadius: 1,
  px: 1,
  py: 0.4,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 14,
  color: 'text.primary',
  textAlign: 'left',
  '&:hover': { borderColor: 'primary.main' },
};

const EditChip = ({
  label,
  onOpen,
}: {
  label: ReactNode;
  onOpen: (e: React.MouseEvent<HTMLElement>) => void;
}): ReactElement => (
  <Box component="button" onClick={onOpen} sx={chipSx}>
    {label}
    <CaretIcon sx={{ fontSize: 16, opacity: 0.6 }} />
  </Box>
);

// A node card in the flow. `accent` tints the left edge so condition / action / terminal nodes read
// apart at a glance.
function Node({ accent, children, sx }: { accent: string; children: ReactNode; sx?: SxProps<Theme> }): ReactElement {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: accent,
        borderRadius: 2,
        bgcolor: 'background.paper',
        p: 1.5,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// A labelled vertical connector (the "YES"/"NO" edges between nodes).
function Connector({ label, icon, color }: { label: string; icon: ReactNode; color: string }): ReactElement {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5, pl: 1.5 }}>
      <Box sx={{ width: 0, height: 22, borderLeft: '2px dashed', borderColor: color, ml: 0.5 }} />
      <Box sx={{ display: 'inline-flex', color, alignItems: 'center' }}>{icon}</Box>
      <Typography variant="caption" sx={{ color, fontWeight: 700, letterSpacing: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

// --- Condition (recursive; groups render as a nested AND/OR cluster inside the node) ---

function FlowCondition({
  value,
  onChange,
}: {
  value: RuleCondition;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  if (value.type === 'group') {
    const setAt = (i: number, next: RuleCondition): void =>
      onChange({ ...value, conditions: value.conditions.map((c, idx) => (idx === i ? next : c)) });
    const removeAt = (i: number): void =>
      onChange({ ...value, conditions: value.conditions.filter((_, idx) => idx !== i) });
    return (
      <Box>
        <PopoverEditable
          width={420}
          trigger={(open) => (
            <Chip
              size="small"
              color="warning"
              label={value.logic === 'and' ? 'ALL OF' : 'ANY OF'}
              onClick={open}
              onDelete={open}
              deleteIcon={<CaretIcon />}
            />
          )}
        >
          <Stack spacing={2}>
            <LogicSelect value={value.logic} onChange={(logic) => onChange({ ...value, logic })} />
            <ConditionTypeSelect value={value} onChange={onChange} />
          </Stack>
        </PopoverEditable>
        <Box sx={{ borderLeft: '2px solid', borderColor: 'warning.light', pl: 1.5, ml: 1, mt: 0.75 }}>
          {value.conditions.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <FlowCondition value={c} onChange={(next) => setAt(i, next)} />
              <IconButton size="small" onClick={() => removeAt(i)} disabled={value.conditions.length <= 1}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onChange({ ...value, conditions: [...value.conditions, newFieldCondition()] })}
          >
            condition
          </Button>
        </Box>
      </Box>
    );
  }

  const label = value.type === 'all' ? 'any claim' : describeFieldCondition(value);
  return (
    <PopoverEditable trigger={(open) => <EditChip label={label} onOpen={open} />}>
      <Stack spacing={2}>
        <ConditionTypeSelect value={value} onChange={onChange} />
        {value.type === 'field' && <FieldConditionFields value={value} onChange={onChange} />}
      </Stack>
    </PopoverEditable>
  );
}

// --- Outcome node ---

function OutcomeNode({ value, onChange }: { value: RuleOutcome; onChange: (next: RuleOutcome) => void }): ReactElement {
  const kindPill = (
    <PopoverEditable
      width={320}
      trigger={(open) => (
        <Chip size="small" variant="outlined" label="DO" onClick={open} onDelete={open} deleteIcon={<CaretIcon />} />
      )}
    >
      <OutcomeTypeSelect value={value} onChange={onChange} />
    </PopoverEditable>
  );

  if (value.type === 'conditional') {
    return (
      <Node accent="#2169F5">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {kindPill}
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            BRANCH FURTHER
          </Typography>
        </Box>
        <FlowEditor
          value={value.conditional}
          onChange={(conditional) => onChange({ type: 'conditional', conditional })}
        />
      </Node>
    );
  }

  if (value.type === 'noop') {
    return (
      <Node accent="#667085">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {kindPill}
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            do nothing
          </Typography>
        </Box>
      </Node>
    );
  }

  const { actions } = value;
  const setAt = (i: number, next: (typeof actions)[number]): void =>
    onChange({ type: 'actions', actions: actions.map((a, idx) => (idx === i ? next : a)) });
  return (
    <Node accent="#2E7D32">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>{kindPill}</Box>
      <Stack spacing={0.75}>
        {actions.map((a, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PopoverEditable trigger={(open) => <EditChip label={describeAction(a)} onOpen={open} />}>
              <ActionFields value={a} onChange={(next) => setAt(i, next)} />
            </PopoverEditable>
            <IconButton
              size="small"
              onClick={() => onChange({ type: 'actions', actions: actions.filter((_, idx) => idx !== i) })}
              disabled={actions.length <= 1}
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        ))}
        <Box>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onChange({ type: 'actions', actions: [...actions, newAction()] })}
          >
            action
          </Button>
        </Box>
      </Stack>
    </Node>
  );
}

// --- Conditional (top-level entry point, same signature as the other variants) ---

export function FlowEditor({
  value,
  onChange,
}: {
  value: RuleConditional;
  onChange: (next: RuleConditional) => void;
}): ReactElement {
  const setBranchAt = (index: number, next: RuleConditional['branches'][number]): void =>
    onChange({ ...value, branches: value.branches.map((b, i) => (i === index ? next : b)) });

  const hasFallThrough = value.otherwise !== undefined;

  return (
    <Box>
      {value.branches.map((branch, index) => (
        <Box key={index}>
          <Node accent="#2169F5">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" color="primary" label={index === 0 ? 'IF' : 'ELSE IF'} sx={{ fontWeight: 700 }} />
                <FlowCondition
                  value={branch.condition}
                  onChange={(condition) => setBranchAt(index, { ...branch, condition })}
                />
              </Box>
              {value.branches.length > 1 && (
                <IconButton
                  size="small"
                  onClick={() => onChange({ ...value, branches: value.branches.filter((_, i) => i !== index) })}
                  aria-label="Remove branch"
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
          </Node>

          <Box sx={{ display: 'flex' }}>
            <Box sx={{ width: 24, borderRight: '2px solid', borderColor: 'success.light', ml: 1 }} />
            <Box sx={{ flex: 1, pl: 2, py: 1 }}>
              <Connector label="YES" icon={<YesIcon sx={{ fontSize: 16 }} />} color="#2E7D32" />
              <OutcomeNode value={branch.outcome} onChange={(outcome) => setBranchAt(index, { ...branch, outcome })} />
            </Box>
          </Box>

          <Connector
            label={index < value.branches.length - 1 || hasFallThrough ? 'NO' : 'NO — claim continues'}
            icon={<NoIcon sx={{ fontSize: 16 }} />}
            color="#667085"
          />
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange({ ...value, branches: [...value.branches, newBranch()] })}
        >
          else-if branch
        </Button>
        {!hasFallThrough && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ ...value, otherwise: newOutcome() })}>
            otherwise (else)
          </Button>
        )}
      </Box>

      {hasFallThrough && value.otherwise !== undefined && (
        <Box sx={{ mb: 1 }}>
          <Node accent="#FB8C00">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Chip size="small" color="warning" label="OTHERWISE" sx={{ fontWeight: 700 }} />
              <IconButton
                size="small"
                onClick={() => onChange({ ...value, otherwise: undefined })}
                aria-label="Remove else"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <OutcomeNode value={value.otherwise} onChange={(otherwise) => onChange({ ...value, otherwise })} />
          </Node>
        </Box>
      )}

      <Node accent="#2E7D32" sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(46,125,50,0.06)' }}>
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="body2" fontWeight={600} color="success.dark">
          Claim continues through the rest of the engine
        </Typography>
      </Node>
    </Box>
  );
}
