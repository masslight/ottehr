import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { RuleCondition, RuleConditional, RuleOutcome } from 'utils';
import { otherColors } from '../../themes/ottehr/colors';
import {
  ActionFields,
  ConditionTypeSelect,
  FieldConditionFields,
  indentSx,
  LogicSelect,
  newAction,
  newBranch,
  newFieldCondition,
  newOutcome,
  newRuleConditional,
  OutcomeTypeSelect,
} from './shared';

// ---------------------------------------------------------------------------
// Variant A — "Form builder"
//
// The original rule editor: a recursive set of always-on form controls for the if / else-if / else
// conditional tree. Every condition and action exposes its dropdowns at all times. Components are
// declared (hoisted) so the mutual recursion (Conditional -> Outcome -> Conditional, Condition ->
// group -> Condition) resolves cleanly. All the field/action mechanics live in ./shared; this file
// is only the layout.
// ---------------------------------------------------------------------------

// Re-exported for callers that historically imported the conditional factory from here.
export { newRuleConditional };

// --- Condition ---

function ConditionEditor({
  value,
  onChange,
}: {
  value: RuleCondition;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  return (
    <Box>
      <ConditionTypeSelect value={value} onChange={onChange} />
      {value.type === 'field' && (
        <Box sx={{ mt: 1 }}>
          <FieldConditionFields value={value} onChange={onChange} />
        </Box>
      )}
      {value.type === 'group' && <GroupConditionEditor value={value} onChange={onChange} />}
    </Box>
  );
}

function GroupConditionEditor({
  value,
  onChange,
}: {
  value: Extract<RuleCondition, { type: 'group' }>;
  onChange: (next: RuleCondition) => void;
}): ReactElement {
  const setConditionAt = (index: number, next: RuleCondition): void =>
    onChange({ ...value, conditions: value.conditions.map((c, i) => (i === index ? next : c)) });
  const removeAt = (index: number): void =>
    onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) });
  return (
    <Box sx={{ mt: 1, ...indentSx }}>
      <Box sx={{ mb: 1 }}>
        <LogicSelect value={value.logic} onChange={(logic) => onChange({ ...value, logic })} />
      </Box>
      {value.conditions.map((condition, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <ConditionEditor value={condition} onChange={(next) => setConditionAt(index, next)} />
          </Box>
          <IconButton size="small" onClick={() => removeAt(index)} disabled={value.conditions.length <= 1}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange({ ...value, conditions: [...value.conditions, newFieldCondition()] })}
      >
        Add condition
      </Button>
    </Box>
  );
}

// --- Outcome ---

function OutcomeEditor({
  value,
  onChange,
}: {
  value: RuleOutcome;
  onChange: (next: RuleOutcome) => void;
}): ReactElement {
  const actions = value.type === 'actions' ? value.actions : [];
  return (
    <Box>
      <OutcomeTypeSelect value={value} onChange={onChange} />
      {value.type === 'actions' && (
        <Box sx={{ mt: 1, ...indentSx }}>
          {actions.map((action, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <ActionFields
                  value={action}
                  onChange={(next) =>
                    onChange({ type: 'actions', actions: actions.map((a, i) => (i === index ? next : a)) })
                  }
                />
              </Box>
              <IconButton
                size="small"
                onClick={() => onChange({ type: 'actions', actions: actions.filter((_, i) => i !== index) })}
                disabled={actions.length <= 1}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onChange({ type: 'actions', actions: [...actions, newAction()] })}
          >
            Add action
          </Button>
        </Box>
      )}
      {value.type === 'conditional' && (
        <Box sx={{ mt: 1, ...indentSx }}>
          <ConditionalEditor
            value={value.conditional}
            onChange={(next) => onChange({ type: 'conditional', conditional: next })}
          />
        </Box>
      )}
    </Box>
  );
}

// --- Conditional (top-level entry point) ---

export function ConditionalEditor({
  value,
  onChange,
}: {
  value: RuleConditional;
  onChange: (next: RuleConditional) => void;
}): ReactElement {
  const setBranchAt = (index: number, next: RuleConditional['branches'][number]): void =>
    onChange({ ...value, branches: value.branches.map((b, i) => (i === index ? next : b)) });

  return (
    <Box>
      {value.branches.map((branch, index) => (
        <Box
          key={index}
          sx={{
            border: `1px solid ${otherColors.lightDivider}`,
            borderRadius: 2,
            p: 2,
            mb: 1.5,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="primary.dark" fontWeight={600}>
              {index === 0 ? 'IF' : 'ELSE IF'}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onChange({ ...value, branches: value.branches.filter((_, i) => i !== index) })}
              disabled={value.branches.length <= 1}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <ConditionEditor
            value={branch.condition}
            onChange={(condition) => setBranchAt(index, { ...branch, condition })}
          />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>
            THEN
          </Typography>
          <OutcomeEditor value={branch.outcome} onChange={(outcome) => setBranchAt(index, { ...branch, outcome })} />
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange({ ...value, branches: [...value.branches, newBranch()] })}
        sx={{ mb: 1 }}
      >
        Add else-if branch
      </Button>

      <Box sx={{ mt: 1 }}>
        {value.otherwise === undefined ? (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ ...value, otherwise: newOutcome() })}>
            Add ELSE
          </Button>
        ) : (
          <Box
            sx={{
              border: `1px dashed ${otherColors.lightDivider}`,
              borderRadius: 2,
              p: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" color="primary.dark" fontWeight={600}>
                ELSE
              </Typography>
              <IconButton size="small" onClick={() => onChange({ ...value, otherwise: undefined })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <OutcomeEditor value={value.otherwise} onChange={(otherwise) => onChange({ ...value, otherwise })} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
