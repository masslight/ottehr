import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError, PreSubmissionRule, PreSubmissionRuleInput, RuleConditional } from 'utils';
import { getBillingRules, saveBillingRules } from '../api/api';
import { TextInput } from '../components/input/TextInput';
import { ConditionalEditor, newRuleConditional } from '../components/rules/RuleBuilder';
import { useApiClients } from '../hooks/useAppClients';

// The rule id is not a form field: a new rule is saved without one and save-billing-rules assigns it.
interface RuleFormValues {
  name: string;
  description: string;
  enabled: boolean;
  conditional: RuleConditional;
}

const blankForm = (): RuleFormValues => ({
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
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<RuleFormValues>({ defaultValues: blankForm() });
  const { control, handleSubmit, reset } = methods;

  const load = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingRules(oystehrZambda);
      setAllRules(data.rules);
      setVersionId(data.versionId);
      if (isNew) {
        reset(blankForm());
        setFound(true);
      } else {
        const existing = data.rules.find((r) => r.id === id);
        if (!existing) {
          setError('Rule not found. It may have been deleted.');
          setFound(false);
        } else {
          const { name, description, enabled, conditional } = existing;
          reset({ name, description, enabled, conditional });
          setFound(true);
        }
      }
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load rule' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id, isNew, reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = handleSubmit(async (values) => {
    if (!oystehrZambda) return;
    setSaving(true);
    setError(null);
    try {
      const rule: PreSubmissionRuleInput = {
        ...(isNew ? {} : { id }),
        name: values.name.trim(),
        description: values.description.trim(),
        enabled: values.enabled,
        conditional: values.conditional,
      };
      const exists = !isNew && allRules.some((r) => r.id === id);
      const nextRules: PreSubmissionRuleInput[] = exists
        ? allRules.map((r) => (r.id === id ? rule : r))
        : [...allRules, rule];
      await saveBillingRules(oystehrZambda, { rules: nextRules, expectedVersionId: versionId });
      navigate('/rules');
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to save rule' }));
    } finally {
      setSaving(false);
    }
  });

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

          {found && (
            <FormProvider {...methods}>
              <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 900 }}>
                <TextInput name="name" label="Name" required fullWidth />
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description"
                      size="small"
                      placeholder="What is this rule for?"
                      multiline
                      rows={2}
                      fullWidth
                    />
                  )}
                />
                <Controller
                  name="enabled"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label="Enabled"
                    />
                  )}
                />

                <Typography variant="h6" color="primary.dark" fontWeight={600} sx={{ mt: 1 }}>
                  Logic
                </Typography>
                <ConditionalEditor name="conditional" />

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button variant="contained" onClick={() => void onSave()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save rule'}
                  </Button>
                  <Button onClick={() => navigate('/rules')} disabled={saving}>
                    Cancel
                  </Button>
                </Box>
              </Box>
            </FormProvider>
          )}
        </>
      )}
    </Box>
  );
}
