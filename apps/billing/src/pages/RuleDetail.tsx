import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError, PreSubmissionRule, PreSubmissionRuleInput } from 'utils';
import { getBillingRules, saveBillingRules } from '../api/api';
import { ConditionalEditor, newRuleConditional } from '../components/rules/RuleBuilder';
import { useApiClients } from '../hooks/useAppClients';

// A new rule has no id: save-billing-rules assigns one when the rule is first saved.
const blankRule = (): PreSubmissionRuleInput => ({
  name: '',
  description: '',
  enabled: true,
  conditional: newRuleConditional(),
});

export default function RuleDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [allRules, setAllRules] = useState<PreSubmissionRule[]>([]);
  const [versionId, setVersionId] = useState<string | undefined>();
  const [rule, setRule] = useState<PreSubmissionRuleInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingRules(oystehrZambda);
      setAllRules(data.rules);
      setVersionId(data.versionId);
      if (isNew) {
        setRule(blankRule());
      } else {
        const found = data.rules.find((r) => r.id === id);
        if (!found) {
          setError('Rule not found. It may have been deleted.');
          setRule(null);
        } else {
          setRule(found);
        }
      }
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load rule' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !rule) return;
    if (!rule.name.trim()) {
      setError('Rule name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trimmed = { ...rule, name: rule.name.trim(), description: rule.description.trim() };
      const exists = trimmed.id != null && allRules.some((r) => r.id === trimmed.id);
      const nextRules: PreSubmissionRuleInput[] = exists
        ? allRules.map((r) => (r.id === trimmed.id ? trimmed : r))
        : [...allRules, trimmed];
      await saveBillingRules(oystehrZambda, { rules: nextRules, expectedVersionId: versionId });
      navigate('/rules');
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to save rule' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/rules')} sx={{ mb: 2 }}>
        Back to rules
      </Button>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 0.5 }}>
            {isNew ? 'New rule' : 'Edit rule'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Rules run top to bottom. A rule that applies the Hold tag stops the engine and holds the claim.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {rule && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 900 }}>
              <TextField
                label="Name"
                size="small"
                value={rule.name}
                onChange={(e) => setRule({ ...rule, name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Description"
                size="small"
                value={rule.description}
                onChange={(e) => setRule({ ...rule, description: e.target.value })}
                placeholder="What is this rule for?"
                multiline
                rows={2}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch checked={rule.enabled} onChange={(e) => setRule({ ...rule, enabled: e.target.checked })} />
                }
                label="Enabled"
              />

              <Typography variant="h6" color="primary.dark" fontWeight={600} sx={{ mt: 1 }}>
                Logic
              </Typography>
              <ConditionalEditor
                value={rule.conditional}
                onChange={(conditional) => setRule({ ...rule, conditional })}
              />

              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !rule.name.trim()}>
                  {saving ? 'Saving…' : 'Save rule'}
                </Button>
                <Button onClick={() => navigate('/rules')} disabled={saving}>
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
