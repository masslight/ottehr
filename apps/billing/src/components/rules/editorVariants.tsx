import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { ComponentType, ReactElement, useCallback, useState } from 'react';
import { RuleConditional } from 'utils';
import { ConditionalEditor } from './RuleBuilder';
import { FlowEditor } from './RuleFlow';
import { OutlineEditor } from './RuleOutline';

// ---------------------------------------------------------------------------
// Rule editor variants
//
// Every variant is just a different *presentation* of the same RuleConditional editor — same value +
// onChange contract — so they're fully interchangeable. The registry plus a localStorage-backed
// picker lets you flip between them on the rule screen to compare how each reads, and makes it cheap
// to keep (or drop) any of them later.
// ---------------------------------------------------------------------------

export interface RuleEditorProps {
  value: RuleConditional;
  onChange: (next: RuleConditional) => void;
}

export type RuleEditorVariantId = 'builder' | 'outline' | 'flow';

export interface RuleEditorVariant {
  id: RuleEditorVariantId;
  label: string;
  description: string;
  Editor: ComponentType<RuleEditorProps>;
}

export const RULE_EDITOR_VARIANTS: RuleEditorVariant[] = [
  {
    id: 'builder',
    label: 'Form builder',
    description: 'The original: stacked forms with every dropdown visible at once.',
    Editor: ConditionalEditor,
  },
  {
    id: 'outline',
    label: 'Outline',
    description: 'Reads like indented pseudo-code; click any chip to edit that piece.',
    Editor: OutlineEditor,
  },
  {
    id: 'flow',
    label: 'Flow',
    description: 'A decision flowchart that makes the yes / no branching explicit.',
    Editor: FlowEditor,
  },
];

export const DEFAULT_VARIANT: RuleEditorVariantId = 'builder';
const STORAGE_KEY = 'billing.ruleEditorVariant';

const isVariantId = (v: string | null): v is RuleEditorVariantId =>
  RULE_EDITOR_VARIANTS.some((variant) => variant.id === v);

// Persist the chosen variant so flipping back and forth (and reloading) keeps your pick. Reads/writes
// are guarded since localStorage can throw (private mode / SSR).
export function useRuleEditorVariant(): [RuleEditorVariantId, (id: RuleEditorVariantId) => void] {
  const [variant, setVariant] = useState<RuleEditorVariantId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return isVariantId(stored) ? stored : DEFAULT_VARIANT;
    } catch {
      return DEFAULT_VARIANT;
    }
  });

  const select = useCallback((id: RuleEditorVariantId) => {
    setVariant(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore — non-persisted is fine
    }
  }, []);

  return [variant, select];
}

export function getRuleEditorVariant(id: RuleEditorVariantId): RuleEditorVariant {
  return RULE_EDITOR_VARIANTS.find((v) => v.id === id) ?? RULE_EDITOR_VARIANTS[0];
}

// The switcher shown above the editor. Each option carries a tooltip describing the presentation.
export function RuleEditorVariantPicker({
  value,
  onChange,
}: {
  value: RuleEditorVariantId;
  onChange: (id: RuleEditorVariantId) => void;
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="body2" color="text.secondary">
        Editor style
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value}
        onChange={(_, next: RuleEditorVariantId | null) => next && onChange(next)}
      >
        {RULE_EDITOR_VARIANTS.map((variant) => (
          <Tooltip key={variant.id} title={variant.description} arrow>
            <ToggleButton value={variant.id} sx={{ textTransform: 'none', px: 1.5 }}>
              {variant.label}
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
