import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { Fragment, lazy, ReactElement, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import {
  checkCompatibility,
  DATE_FORMAT_LABELS,
  FormFieldBinding,
  FormTemplateMapping,
  FormTransform,
  isBindingComplete,
  requiredTransformKind,
} from 'utils/lib/form-tokens/mapping';
import { TOKEN_CATALOG } from 'utils/lib/form-tokens/token-catalog';
import { FormFieldInfo, GetFormTemplateDetailOutput } from 'utils/lib/types/api/form-template.types';
import { FormTokenDescriptor } from 'utils/lib/types/api/form-token.types';
import { getFormTemplateDetail, saveFormTemplateMapping } from './form-templates.api';
import { FormTemplateActionsBar } from './FormTemplateActionsBar';
import { FormTemplateDetailsCard } from './FormTemplateDetailsCard';
import { clearMappingDraft, readMappingDraft, writeMappingDraft } from './mapping-draft';
import { FORM_TEMPLATES_QUERY_KEY } from './useFormTemplates';

/**
 * Loaded on demand: pdf.js is a substantial dependency and this is the only screen that renders a PDF,
 * so it has no business in the bundle every user downloads at sign-in.
 */
const FormTemplatePdfPreview = lazy(() =>
  import('./FormTemplatePdfPreview').then((module) => ({ default: module.FormTemplatePdfPreview }))
);

/** Names some authoring tools emit when they serialise a missing value: `undefined`, `undefined_3`, … */
const PLACEHOLDER_NAME = /^(undefined|null)(_\d+)?$/i;

/**
 * Vertical slack, in PDF points, within which two fields count as sharing a row.
 *
 * Fields laid out side by side are rarely aligned to the point, so comparing `y` exactly would interleave
 * a row's boxes with those above and below it.
 */
const SAME_ROW_TOLERANCE = 6;

/**
 * Orders fields the way they appear on the printed page — page by page, top to bottom, then left to
 * right — rather than in the order the PDF stores them.
 *
 * That storage order is arbitrary and frequently groups unrelated fields together, which is what puts a
 * run of unlabelled checkboxes nowhere near the labelled ones they sit beside on paper. Reading order
 * lets someone work down the form with the PDF open next to them, and gives an unlabelled field context
 * from its neighbours. Fields with no resolvable position sort last rather than disappearing.
 */
const byReadingOrder = (a: FormFieldInfo, b: FormFieldInfo): number => {
  if (!a.position || !b.position) return Number(!!b.position) - Number(!!a.position);
  if (a.position.page !== b.position.page) return a.position.page - b.position.page;
  // PDF user space puts the origin at the bottom-left, so a larger y is nearer the top of the page.
  if (Math.abs(a.position.y - b.position.y) > SAME_ROW_TOLERANCE) return b.position.y - a.position.y;
  return a.position.x - b.position.x;
};

/**
 * What the administrator sees for a field: the author's tooltip, then the name, then whatever the field
 * itself contains. The last tier is load-bearing — some PDFs set both tooltip and name to "undefined",
 * and listing a radio group's options identifies it where its name cannot. The name stays in the tooltip.
 */
const fieldLabel = (field: FormFieldInfo): string => {
  const alternateText = field.alternateText?.trim();
  if (alternateText) return alternateText;

  const name = field.name?.trim();
  if (name && !PLACEHOLDER_NAME.test(name)) return name;

  // The choices are how the form itself identifies such a field to whoever is reading the page, so
  // "Male / Female" says more than any wording we could wrap around it. "On" is the default export value
  // of an unlabelled checkbox and describes nothing.
  const choices = (field.options ?? []).map((option) => option.label).filter((label) => label.toLowerCase() !== 'on');
  if (choices.length > 0) return choices.join(' / ');

  // Nothing descriptive left. The raw name is at least unique, which keeps otherwise identical rows apart.
  return name || `Unlabelled ${field.type}`;
};

/**
 * A label with break opportunities at the separators generated field names are assembled from.
 *
 * These names are paths — `topmostSubform[0].Page1[0].f1_03[0]` — and the dots and underscores joining
 * their parts are the only word boundaries they have. CSS does not treat either as one, so without this the
 * whole path is a single unbreakable word and the only way to fit it is to break mid-token: `topmostSub` /
 * `form[0]`, which reads as a different name than the row above it rather than the same one wrapped.
 *
 * `<wbr>` says a break is permitted here without putting anything in the text, so the name still reads and
 * copies exactly as the PDF spells it. Rewriting the dots as spaces would have wrapped just as well, but it
 * would also mean the name on screen is no longer the name in the file — and matching the two by eye is
 * what this column is for.
 */
const withBreakOpportunities = (label: string): ReactNode =>
  // Split after each separator so it stays at the end of the line it belongs to, the way a hyphen does.
  label.split(/(?<=[._])/).map((part, index) => (
    <Fragment key={index}>
      {part}
      <wbr />
    </Fragment>
  ));

/** Order-insensitive, since local edit order has nothing to do with how the server stored them. */
const sameBindings = (a: FormFieldBinding[], b: FormFieldBinding[]): boolean => {
  const normalise = (list: FormFieldBinding[]): string =>
    JSON.stringify([...list].sort((x, y) => x.fieldName.localeCompare(y.fieldName)));
  return normalise(a) === normalise(b);
};

export const FormTemplateDetailPage = (): ReactElement => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [bindings, setBindings] = useState<Record<string, FormFieldBinding>>({});
  const [dirty, setDirty] = useState(false);
  // Which row is called out on the rendered page. Selection is one-way: choosing a row highlights the
  // field, so an ambiguous label can be resolved by looking at where it actually sits.
  const [selectedFieldName, setSelectedFieldName] = useState<string | undefined>(undefined);
  const [pageNumber, setPageNumber] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [FORM_TEMPLATES_QUERY_KEY, 'detail', templateId],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      if (!templateId) throw new Error('No template id');
      return getFormTemplateDetail(oystehrZambda, { documentReferenceId: templateId });
    },
    enabled: !!oystehrZambda && !!templateId,
  });

  const hydratedFor = useRef<string | undefined>(undefined);

  /**
   * Identifies the document being mapped, rather than just the template.
   *
   * Replacing a template's PDF leaves the id unchanged while replacing everything the mapping refers to,
   * so the field inventory is what the editor has to track. Editing a title changes neither.
   */
  const inventoryKey = useMemo(
    () => (data && templateId ? `${templateId}:${data.fields.map((field) => field.name).join('|')}` : undefined),
    [data, templateId]
  );

  /**
   * Seed the editor once per document, from a local draft if one is newer than what the server holds.
   *
   * Deliberately not keyed on `data`: this query refetches on window focus and after the preview's
   * reload button, and re-seeding on every refetch would silently discard whatever the user had typed
   * since they arrived.
   *
   * It is keyed on the inventory rather than the template id, though, so replacing the PDF from the form
   * above re-seeds from the reconciled mapping. Without that the editor would keep showing bindings
   * against fields the new document no longer has.
   */
  useEffect(() => {
    if (!data || !templateId || !inventoryKey || hydratedFor.current === inventoryKey) return;
    hydratedFor.current = inventoryKey;

    const saved = (data.mapping as FormTemplateMapping | undefined)?.bindings ?? [];
    const draft = readMappingDraft(
      templateId,
      data.fields.map((field) => field.name)
    );
    const restoring = !!draft && !sameBindings(draft, saved);
    const source = restoring ? draft : saved;

    setBindings(Object.fromEntries(source.map((binding) => [binding.fieldName, binding])));
    setDirty(restoring);
    if (restoring) {
      enqueueSnackbar('Restored unsaved mapping changes from this session', { variant: 'info' });
    }
  }, [data, templateId, inventoryKey]);

  // Keep the draft current while there is anything unsaved to lose. Stamped with the inventory it was
  // authored against, so it is not restored over a document whose fields have since changed.
  useEffect(() => {
    if (!templateId || !data) return;
    if (!dirty) return;
    writeMappingDraft(
      templateId,
      data.fields.map((field) => field.name),
      Object.values(bindings)
    );
  }, [bindings, data, dirty, templateId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('API client not available');
      if (!templateId) throw new Error('No template id');
      const mapping: FormTemplateMapping = { version: 1, bindings: Object.values(bindings) };
      await saveFormTemplateMapping(oystehrZambda, { documentReferenceId: templateId, mapping });
      return mapping;
    },
    onSuccess: (savedMapping) => {
      enqueueSnackbar('Mapping saved', { variant: 'success' });
      setDirty(false);
      if (templateId) {
        clearMappingDraft(templateId);

        // Write the saved mapping straight into the cached detail rather than refetching it. Refetching
        // would mint a new presigned URL and make the preview re-download the PDF for no reason; leaving
        // the cache alone is worse still, because reopening this page would then hydrate from a mapping
        // that predates the save and appear to have lost the work.
        queryClient.setQueryData<GetFormTemplateDetailOutput>(
          [FORM_TEMPLATES_QUERY_KEY, 'detail', templateId],
          (previous) => (previous ? { ...previous, mapping: savedMapping } : previous)
        );
      }

      void queryClient.invalidateQueries({
        queryKey: [FORM_TEMPLATES_QUERY_KEY],
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
    },
    onError: (err) => {
      enqueueSnackbar(`Failed to save: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' });
    },
  });

  /**
   * Fields worth showing: those the PDF lets us write to, and that at least one token could supply.
   *
   * The second half matters more than it sounds: a field whose type no token can supply would otherwise
   * occupy a row offering an empty dropdown. Filtering on compatibility rather than on the field's own
   * properties means the list follows the catalog as it grows, instead of needing a rule rewritten.
   */
  const { mappableFields, omittedCount } = useMemo(() => {
    const writable = (data?.fields ?? []).filter((f) => f.mappable);
    const bindable = writable.filter((field) =>
      TOKEN_CATALOG.some((token) => checkCompatibility(token.type, field.type) !== 'incompatible')
    );
    return {
      mappableFields: bindable.slice().sort(byReadingOrder),
      omittedCount: writable.length - bindable.length,
    };
  }, [data]);

  const mappedFieldNames = useMemo(() => new Set(Object.keys(bindings)), [bindings]);

  /**
   * The table shows one page at a time, matching the preview beside it — a field is identified by where
   * it sits, so listing fields from pages you cannot see defeats the point.
   *
   * Filtered on `position.page` rather than `pages`, because that is the widget the overlay highlights. A
   * field with widgets on several pages therefore appears once, on the page where it is drawn. Anything
   * with no resolvable position falls back to the first page so it stays reachable rather than vanishing.
   */
  const visibleFields = useMemo(
    () => mappableFields.filter((f) => (f.position ? f.position.page === pageNumber - 1 : pageNumber === 1)),
    [mappableFields, pageNumber]
  );

  const tokensByKey = useMemo(
    () => Object.fromEntries(TOKEN_CATALOG.map((token) => [token.key, token])) as Record<string, FormTokenDescriptor>,
    []
  );

  const setBinding = (fieldName: string, next: FormFieldBinding | undefined): void => {
    setBindings((prev) => {
      const copy = { ...prev };
      if (next) copy[fieldName] = next;
      else delete copy[fieldName];
      return copy;
    });
    setDirty(true);
  };

  const incompleteCount = mappableFields.filter((field) => {
    const binding = bindings[field.name];
    const token = binding && tokensByKey[binding.tokenKey];
    return binding && token && !isBindingComplete(binding, token.type, field.type);
  }).length;

  const boundCount = mappableFields.filter((field) => bindings[field.name]).length;

  // What the selected field is filled with, spelled out for the preview to caption its rectangle.
  const selectedToken = selectedFieldName ? tokensByKey[bindings[selectedFieldName]?.tokenKey ?? ''] : undefined;
  const selectedFieldMapping = selectedToken ? `${selectedToken.group} · ${selectedToken.label}` : undefined;

  if (isLoading)
    return (
      <PageContainer tabTitle="Form template">
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );

  if (isError || !data)
    return (
      <PageContainer tabTitle="Form template">
        <Typography color="error">This form template could not be loaded.</Typography>
      </PageContainer>
    );

  return (
    <PageContainer tabTitle={data.item.title}>
      <>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
          <RoundedButton startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/form-templates')}>
            Back
          </RoundedButton>
          <Typography variant="h6">{data.item.title}</Typography>
        </Stack>

        <Stack spacing={3}>
          <FormTemplateActionsBar item={data.item} />

          <FormTemplateDetailsCard item={data.item} />

          {/* `overflow: visible` is load-bearing. MUI's Card clips by default, and any clipping ancestor
            silently disables `position: sticky` for everything inside it — which is why the preview
            column would not follow the field list however it was styled. */}
          <Card variant="outlined" sx={{ overflow: 'visible' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Field mapping
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={2}>
                    <Typography variant="body2" color="text.secondary">
                      {boundCount} of {mappableFields.length} fields mapped
                    </Typography>
                    <RoundedButton
                      variant="contained"
                      startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
                      disabled={!oystehrZambda || !dirty || saveMutation.isPending || incompleteCount > 0}
                      onClick={() => saveMutation.mutate()}
                    >
                      Save mapping
                    </RoundedButton>
                  </Stack>
                </Stack>

                {data.status === 'printable' && (
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    This PDF has no fillable fields, so there is nothing to map. Providers can still open and print it.
                  </Typography>
                )}

                {omittedCount > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {omittedCount} field{omittedCount === 1 ? '' : 's'} on this form cannot be filled from chart data
                    and are left for the provider to complete.
                  </Typography>
                )}

                {incompleteCount > 0 && (
                  <Typography color="warning.main" variant="body2" sx={{ mb: 1 }}>
                    {incompleteCount} mapping{incompleteCount === 1 ? ' needs' : 's need'} a format before this can be
                    saved.
                  </Typography>
                )}

                {mappableFields.length > 0 && (
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
                    {data.item.pdfPresignedUrl && (
                      <Box
                        sx={{
                          flex: '0 0 46%',
                          maxWidth: { xs: '100%', lg: '46%' },
                          position: { lg: 'sticky' },
                          top: { lg: 16 },
                          // Sticky alone was not enough: a rendered page is taller than the window, and a
                          // sticky element taller than the viewport still scrolls out of sight. Capping the
                          // height gives the preview somewhere to scroll internally instead.
                          maxHeight: { lg: 'calc(100vh - 32px)' },
                          display: 'flex',
                          flexDirection: 'column',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                          p: 1,
                        }}
                      >
                        <Suspense
                          fallback={
                            // Approximate page proportions, to hold the space the preview will take. Without
                            // it the row collapses to the height of the spinner and jumps when pdf.js lands.
                            <Box
                              sx={{
                                width: '100%',
                                aspectRatio: '8.5 / 11',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <CircularProgress size={20} />
                            </Box>
                          }
                        >
                          <FormTemplatePdfPreview
                            fileUrl={data.item.pdfPresignedUrl}
                            fields={mappableFields}
                            selectedFieldName={selectedFieldName}
                            selectedFieldMapping={selectedFieldMapping}
                            mappedFieldNames={mappedFieldNames}
                            pageNumber={pageNumber}
                            onRetry={() => void refetch()}
                            onPageChange={(next) => {
                              setPageNumber(next);
                              setSelectedFieldName(undefined);
                            }}
                          />
                        </Suspense>
                      </Box>
                    )}

                    <TableContainer sx={{ flex: 1, minWidth: 0 }}>
                      {/* Fixed layout because these names are machine-generated and can run very long with no
                        spaces to break at. Sized to content, one such name widens its column until the control
                        beside it is pushed off the edge — and the control is the part being edited.

                        The larger share goes to the control rather than the name, because the two degrade
                        differently under pressure: a name wraps onto another line and stays entirely readable,
                        while a token label has nowhere to go and is cut mid-word. Space spent on the name is
                        mostly whitespace at the end of a wrapped line; the same space spent on the control is
                        the difference between reading the mapping and guessing at it. */}
                      <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: '45%' }}>Form field</TableCell>
                            <TableCell sx={{ width: '55%' }}>Fill with</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleFields.map((field) => {
                            const binding = bindings[field.name];
                            const token = binding ? tokensByKey[binding.tokenKey] : undefined;
                            const transformKind = token ? requiredTransformKind(token.type, field.type) : undefined;
                            const needsFormat = !!transformKind && !binding?.transform;

                            // Only offer tokens this field could actually accept, so an impossible pairing is
                            // simply not selectable rather than being rejected after the fact.
                            const options = TOKEN_CATALOG.filter(
                              (candidate) => checkCompatibility(candidate.type, field.type) !== 'incompatible'
                            );

                            return (
                              <TableRow
                                key={field.name}
                                hover
                                selected={field.name === selectedFieldName}
                                onClick={() => setSelectedFieldName(field.name)}
                                sx={{ cursor: 'pointer' }}
                              >
                                <TableCell>
                                  <Tooltip title={field.name} placement="top-start">
                                    {/* Wrapped rather than truncated: names like `form1[0].#subform[1].TextField12[0]`
                                      differ only in their last few characters, so an ellipsis at the end would make
                                      distinct rows read identically. Broken mid-token since there is nothing else to
                                      break at, and clamped so one enormous name cannot push the rest of the list off
                                      the screen. The whole name stays in the tooltip. */}
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        // Only reached when a single segment is itself wider than the column;
                                        // the break opportunities above are preferred wherever they fit.
                                        overflowWrap: 'anywhere',
                                        display: '-webkit-box',
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: 3,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      {withBreakOpportunities(fieldLabel(field))}
                                    </Typography>
                                  </Tooltip>
                                  <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                                    <Chip size="small" variant="outlined" label={field.type} />
                                  </Stack>
                                </TableCell>

                                <TableCell>
                                  <Autocomplete
                                    size="small"
                                    fullWidth
                                    options={options}
                                    groupBy={(option) => option.group}
                                    getOptionLabel={(option) => option.label}
                                    value={token ?? null}
                                    onChange={(_e, next) =>
                                      setBinding(
                                        field.name,
                                        next ? { fieldName: field.name, tokenKey: next.key } : undefined
                                      )
                                    }
                                    renderInput={(params) => (
                                      // The group rides on the outline as a floating label rather than inside the
                                      // value, so "First name" is unambiguous without lengthening what is selected.
                                      // Absent when nothing is bound, which lets the placeholder show through.
                                      <TextField {...params} label={token?.group} placeholder="Not mapped" />
                                    )}
                                  />

                                  {/* Only a minority of bindings need a format, so it appears beneath the token it
                            belongs to rather than occupying a column that is empty on most rows. */}
                                  {transformKind === 'dateFormat' && (
                                    <TextField
                                      select
                                      size="small"
                                      fullWidth
                                      sx={{ mt: 1 }}
                                      // The column header used to supply this context; inline, the control has to
                                      // say what it is on its own.
                                      label="Date format"
                                      error={needsFormat}
                                      helperText={needsFormat ? 'Choose how the date should be written' : undefined}
                                      value={binding?.transform?.kind === 'dateFormat' ? binding.transform.format : ''}
                                      onChange={(e) =>
                                        binding &&
                                        setBinding(field.name, {
                                          ...binding,
                                          transform: { kind: 'dateFormat', format: e.target.value } as FormTransform,
                                        })
                                      }
                                    >
                                      {Object.entries(DATE_FORMAT_LABELS).map(([format, example]) => (
                                        <MenuItem key={format} value={format}>
                                          {example}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  )}

                                  {transformKind === 'booleanText' && (
                                    <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                                      <TextField
                                        size="small"
                                        label="If yes"
                                        error={needsFormat}
                                        value={
                                          binding?.transform?.kind === 'booleanText' ? binding.transform.trueText : ''
                                        }
                                        onChange={(e) =>
                                          binding &&
                                          setBinding(field.name, {
                                            ...binding,
                                            transform: {
                                              kind: 'booleanText',
                                              trueText: e.target.value,
                                              falseText:
                                                binding.transform?.kind === 'booleanText'
                                                  ? binding.transform.falseText
                                                  : '',
                                            },
                                          })
                                        }
                                      />
                                      <TextField
                                        size="small"
                                        label="If no"
                                        value={
                                          binding?.transform?.kind === 'booleanText' ? binding.transform.falseText : ''
                                        }
                                        onChange={(e) =>
                                          binding &&
                                          setBinding(field.name, {
                                            ...binding,
                                            transform: {
                                              kind: 'booleanText',
                                              trueText:
                                                binding.transform?.kind === 'booleanText'
                                                  ? binding.transform.trueText
                                                  : '',
                                              falseText: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    </Stack>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </>
    </PageContainer>
  );
};
