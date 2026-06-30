import { Add as AddIcon, Close as CloseIcon, KeyboardArrowDown as CaretIcon } from '@mui/icons-material';
import { Box, Button, IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
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
// Variant B — "Outline"
//
// Reads the rule like indented pseudo-code: colored IF / ELSE IF / THEN / AND keywords with each
// condition and action shown as a plain-English chip ("Payer ID equals “123456”"). The forms are
// hidden until you click a chip, so the whole branching shape is visible at a glance — you read the
// logic top-to-bottom and only drop into a form to change one piece. Structure (groups, nested
// branches) is conveyed purely by indentation guides.
// ---------------------------------------------------------------------------

type Tone = 'if' | 'then' | 'logic' | 'else';

const TONE_SX: Record<Tone, SxProps<Theme>> = {
  if: { bgcolor: 'primary.main', color: 'primary.contrastText' },
  then: { bgcolor: 'success.main', color: 'success.contrastText' },
  else: { bgcolor: 'text.secondary', color: 'background.paper' },
  logic: { bgcolor: 'warning.main', color: 'warning.contrastText' },
};

// A small uppercase keyword pill (IF / THEN / AND …). Decorative unless wrapped in <Editable/>.
function Keyword({ tone, children }: { tone: Tone; children: ReactNode }): ReactElement {
  return (
    <Box
      component="span"
      sx={{
        ...TONE_SX[tone],
        px: 0.9,
        py: 0.25,
        borderRadius: 1,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.6,
        lineHeight: 1.6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.3,
      }}
    >
      {children}
    </Box>
  );
}

// Alias kept local so the JSX below reads naturally; the implementation is shared across variants.
const Editable = PopoverEditable;

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
  '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light', color: 'primary.contrastText' },
};

const guideSx: SxProps<Theme> = { borderLeft: '2px dashed', borderColor: 'divider', pl: 2, ml: 1.25, mt: 0.5 };

// --- Condition ---

function ConditionView({
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
        <Editable
          width={420}
          trigger={(open) => (
            <Box component="button" onClick={open} sx={{ ...chipSx, border: 'none', bgcolor: 'transparent', p: 0 }}>
              <Keyword tone="logic">{value.logic === 'and' ? 'ALL OF' : 'ANY OF'}</Keyword>
              <CaretIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </Box>
          )}
        >
          <Stack spacing={2}>
            <LogicSelect value={value.logic} onChange={(logic) => onChange({ ...value, logic })} />
            <ConditionTypeSelect value={value} onChange={onChange} />
          </Stack>
        </Editable>
        <Box sx={guideSx}>
          {value.conditions.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <ConditionView value={c} onChange={(next) => setAt(i, next)} />
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
    <Editable
      trigger={(open) => (
        <Box component="button" onClick={open} sx={chipSx}>
          {label}
          <CaretIcon sx={{ fontSize: 16, opacity: 0.6 }} />
        </Box>
      )}
    >
      <Stack spacing={2}>
        <ConditionTypeSelect value={value} onChange={onChange} />
        {value.type === 'field' && <FieldConditionFields value={value} onChange={onChange} />}
      </Stack>
    </Editable>
  );
}

// --- Outcome ---

function OutcomeView({ value, onChange }: { value: RuleOutcome; onChange: (next: RuleOutcome) => void }): ReactElement {
  // The THEN keyword is the kind switcher (take actions / branch / nothing); the body below shows the
  // chosen outcome.
  const thenPill = (
    <Editable
      width={320}
      trigger={(open) => (
        <Box component="button" onClick={open} sx={{ ...chipSx, border: 'none', bgcolor: 'transparent', p: 0 }}>
          <Keyword tone="then">THEN</Keyword>
          <CaretIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        </Box>
      )}
    >
      <OutcomeTypeSelect value={value} onChange={onChange} />
    </Editable>
  );

  if (value.type === 'conditional') {
    return (
      <Box>
        {thenPill}
        <Box sx={guideSx}>
          <OutlineEditor
            value={value.conditional}
            onChange={(conditional) => onChange({ type: 'conditional', conditional })}
          />
        </Box>
      </Box>
    );
  }

  if (value.type === 'noop') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {thenPill}
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          do nothing
        </Typography>
      </Box>
    );
  }

  const { actions } = value;
  const setAt = (i: number, next: (typeof actions)[number]): void =>
    onChange({ type: 'actions', actions: actions.map((a, idx) => (idx === i ? next : a)) });
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      {thenPill}
      <Box>
        {actions.map((a, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Editable
              trigger={(open) => (
                <Box component="button" onClick={open} sx={chipSx}>
                  {describeAction(a)}
                  <CaretIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                </Box>
              )}
            >
              <ActionFields value={a} onChange={(next) => setAt(i, next)} />
            </Editable>
            <IconButton
              size="small"
              onClick={() => onChange({ type: 'actions', actions: actions.filter((_, idx) => idx !== i) })}
              disabled={actions.length <= 1}
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange({ type: 'actions', actions: [...actions, newAction()] })}
        >
          action
        </Button>
      </Box>
    </Box>
  );
}

// --- Conditional (top-level entry point, same signature as the form builder) ---

export function OutlineEditor({
  value,
  onChange,
}: {
  value: RuleConditional;
  onChange: (next: RuleConditional) => void;
}): ReactElement {
  const setBranchAt = (index: number, next: RuleConditional['branches'][number]): void =>
    onChange({ ...value, branches: value.branches.map((b, i) => (i === index ? next : b)) });

  return (
    <Box sx={{ fontSize: 14 }}>
      {value.branches.map((branch, index) => (
        <Box key={index} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Keyword tone="if">{index === 0 ? 'IF' : 'ELSE IF'}</Keyword>
            <ConditionView
              value={branch.condition}
              onChange={(condition) => setBranchAt(index, { ...branch, condition })}
            />
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
          <Box sx={guideSx}>
            <OutcomeView value={branch.outcome} onChange={(outcome) => setBranchAt(index, { ...branch, outcome })} />
          </Box>
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange({ ...value, branches: [...value.branches, newBranch()] })}
      >
        else-if branch
      </Button>

      <Box sx={{ mt: 1.5 }}>
        {value.otherwise === undefined ? (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ ...value, otherwise: newOutcome() })}>
            else
          </Button>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Keyword tone="else">OTHERWISE</Keyword>
              <IconButton
                size="small"
                onClick={() => onChange({ ...value, otherwise: undefined })}
                aria-label="Remove else"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <Box sx={guideSx}>
              <OutcomeView value={value.otherwise} onChange={(otherwise) => onChange({ ...value, otherwise })} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
