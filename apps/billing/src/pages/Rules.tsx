import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon,
  DeleteOutline as DeleteIcon,
  DragIndicator as DragIcon,
  EditOutlined as EditIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Switch, Typography } from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  BillingRuleInput,
  DEFAULT_RULES_ENGINE,
  getApiError,
  isRulesEngineType,
  RULES_ENGINES,
  RulesEngineType,
} from 'utils';
import { getBillingRules, saveBillingRules } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';

export default function Rules(): ReactElement {
  const { engine: engineParam } = useParams<{ engine: string }>();

  if (!isRulesEngineType(engineParam)) {
    return <Navigate to={`/rules/${DEFAULT_RULES_ENGINE}`} replace />;
  }
  return <RulesForEngine engine={engineParam} />;
}

function RulesForEngine({ engine }: { engine: RulesEngineType }): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const engineDef = RULES_ENGINES[engine];

  // Rules loaded from the server always carry ids; a just-duplicated rule has none until the save
  // round-trips (the backend owns rule ids).
  const [rules, setRules] = useState<BillingRuleInput[]>([]);
  const [versionId, setVersionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingRules(oystehrZambda, { engine });
      setRules(data.rules);
      setVersionId(data.versionId);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load rules' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, engine]);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  // Every change (reorder, enable/disable, duplicate, delete) persists the full ordered list.
  const persist = async (next: BillingRuleInput[]): Promise<void> => {
    if (!oystehrZambda) return;
    setSaving(true);
    setError(null);
    setRules(next); // optimistic
    try {
      const data = await saveBillingRules(oystehrZambda, { engine, rules: next, expectedVersionId: versionId });
      setRules(data.rules);
      setVersionId(data.versionId);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to save changes' }));
      await fetchRules(); // resync from server
    } finally {
      setSaving(false);
    }
  };

  const dragIndex = useRef<number | null>(null);
  const handleDrop = (toIndex: number): void => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === toIndex) return;
    const next = [...rules];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    void persist(next);
  };

  const toggleEnabled = (index: number): void =>
    void persist(rules.map((r, i) => (i === index ? { ...r, enabled: !r.enabled } : r)));

  const duplicate = (rule: BillingRuleInput, index: number): void => {
    // The copy is saved without an id; save-billing-rules assigns one and echoes it back.
    const copy: BillingRuleInput = { ...rule, id: undefined, name: `${rule.name} (copy)` };
    const next = [...rules];
    next.splice(index + 1, 0, copy);
    void persist(next);
  };

  const remove = (rule: BillingRuleInput, index: number): void => {
    if (!window.confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    void persist(rules.filter((_, i) => i !== index));
  };

  const summarize = (rule: BillingRuleInput): string => {
    const count = rule.conditional.branches.length;
    return `${count} branch${count === 1 ? '' : 'es'}${rule.conditional.otherwise ? ' + else' : ''}`;
  };

  return (
    <Box p={0}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            {engineDef.label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Rules run top to bottom {engineDef.runsWhen}. Drag to reorder. A rule that applies the Hold tag stops the
            engine and holds the claim.
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/rules/${engine}/new`)}>
          Add Rule
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : rules.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.primary" fontWeight={500}>
            No rules yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add a rule to start shaping claims before they proceed.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rules.map((rule, index) => (
            <Box
              key={rule.id ?? `unsaved-${index}`}
              draggable
              onDragStart={() => (dragIndex.current = index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                bgcolor: 'background.paper',
                border: `1px solid ${otherColors.lightDivider}`,
                borderRadius: 2,
                opacity: rule.enabled ? 1 : 0.55,
              }}
            >
              <Box sx={{ cursor: 'grab', color: 'action.disabled', display: 'flex' }}>
                <DragIcon fontSize="small" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ width: 24, textAlign: 'right' }}>
                {index + 1}
              </Typography>
              <Box
                sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => rule.id && navigate(`/rules/${engine}/${rule.id}`)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontWeight={600} noWrap>
                    {rule.name || 'Untitled rule'}
                  </Typography>
                  <Chip label={summarize(rule)} size="small" variant="outlined" />
                  {!rule.enabled && <Chip label="Disabled" size="small" color="default" />}
                </Box>
                {rule.description && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {rule.description}
                  </Typography>
                )}
              </Box>
              <Switch
                size="small"
                checked={rule.enabled}
                onChange={() => toggleEnabled(index)}
                disabled={saving}
                inputProps={{ 'aria-label': 'Enabled' }}
              />
              <IconButton
                size="small"
                onClick={() => rule.id && navigate(`/rules/${engine}/${rule.id}`)}
                disabled={!rule.id}
                aria-label="Edit"
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => duplicate(rule, index)} disabled={saving} aria-label="Duplicate">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => remove(rule, index)}
                disabled={saving}
                aria-label="Delete"
                sx={{ '&:hover': { color: 'error.dark' } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {!loading && (
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            border: `1px dashed ${otherColors.lightDivider}`,
            borderRadius: 2,
            color: 'success.dark',
          }}
        >
          <CheckCircleIcon fontSize="small" color="success" />
          <Typography variant="body2" fontWeight={500}>
            When all rules pass, {engineDef.onPass}.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
