import { Box, Chip, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import type { ExamItemConfig } from 'config-types';
import { AdminGetTemplateDetailOutput, ChartPlanAddition, examConfig } from 'utils';

interface NotePreviewProps {
  detail: AdminGetTemplateDetailOutput | null;
  acceptedAdditions: ChartPlanAddition[];
}

// Walk the exam config once and build a map from leaf exam field name to its most-specific
// grouping label. A "column" sub-component (e.g. "Right ear" inside the "Ears" section) becomes
// the label for its child checkboxes; other leaves use the top-level section label.
function buildFieldToSectionLabel(config: ExamItemConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [, section] of Object.entries(config)) {
    const walk = (components: Record<string, unknown>, currentLabel: string): void => {
      for (const [key, comp] of Object.entries(components)) {
        const c = comp as { type?: string; label?: string; components?: Record<string, unknown> };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          // Descend with the sub-group's label as the new current label
          walk(c.components, c.label ?? currentLabel);
        } else {
          // Leaf component — record under current label
          map[key] = currentLabel;
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>, section.label);
    walk(section.components.abnormal as Record<string, unknown>, section.label);
    walk(section.components.comment as Record<string, unknown>, section.label);
  }
  return map;
}

const FIELD_TO_SECTION_LABEL = buildFieldToSectionLabel(examConfig.default.components);

interface SectionProps {
  title: string;
  amended?: boolean;
  children: React.ReactNode;
}

function Section({ title, amended, children }: SectionProps): JSX.Element {
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {title}
        </Typography>
        {amended && <Chip size="small" label="from narrative" color="primary" sx={{ height: 18 }} />}
      </Stack>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  );
}

export default function NotePreview({ detail, acceptedAdditions }: NotePreviewProps): JSX.Element | null {
  if (!detail) {
    return (
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }

  const { sections } = detail;
  const hpiAmend = acceptedAdditions.find(
    (a): a is Extract<ChartPlanAddition, { kind: 'hpi-amend' }> => a.kind === 'hpi-amend'
  );
  const moiAmend = acceptedAdditions.find(
    (a): a is Extract<ChartPlanAddition, { kind: 'moi-amend' }> => a.kind === 'moi-amend'
  );
  const mdmAmend = acceptedAdditions.find(
    (a): a is Extract<ChartPlanAddition, { kind: 'mdm-amend' }> => a.kind === 'mdm-amend'
  );

  const effectiveHpi = hpiAmend?.text ?? sections.hpiNote;
  const effectiveMoi = moiAmend?.text ?? sections.moiNote;
  const effectiveMdm = mdmAmend?.text ?? sections.mdm;

  const allDiagnoses = sections.diagnoses.map((d) => ({ code: d.code, display: d.display, isPrimary: false }));

  const abnormalExamFindings = sections.examFindings.filter((f) => f.isAbnormal);
  const examWithNotes = sections.examFindings.filter((f) => f.note && f.note.trim());
  const positiveRosFindings = sections.rosFindings.filter((f) => f.findingState && f.findingState !== 'denies');

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary">
        Note preview (as it would look after Apply)
      </Typography>
      <Stack divider={<Divider flexItem />}>
        {effectiveHpi && (
          <Section title="History of Present Illness" amended={!!hpiAmend}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {effectiveHpi}
            </Typography>
          </Section>
        )}

        {effectiveMoi && (
          <Section title="Mechanism of Injury" amended={!!moiAmend}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {effectiveMoi}
            </Typography>
          </Section>
        )}

        {(sections.rosNote || positiveRosFindings.length > 0) && (
          <Section title="Review of Systems">
            {sections.rosNote && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: positiveRosFindings.length ? 1 : 0 }}>
                {sections.rosNote}
              </Typography>
            )}
            {positiveRosFindings.length > 0 && (
              <Stack spacing={0.25}>
                {positiveRosFindings.map((f) => (
                  <Typography key={f.fieldName} variant="body2">
                    • {f.label}: {f.findingState}
                  </Typography>
                ))}
              </Stack>
            )}
          </Section>
        )}

        {(abnormalExamFindings.length > 0 || examWithNotes.length > 0) && (
          <Section title="Examination">
            {abnormalExamFindings.length > 0 &&
              (() => {
                // Group abnormal findings by their section label (e.g. "Right ear", "Left ear")
                const bySection = new Map<string, typeof abnormalExamFindings>();
                abnormalExamFindings.forEach((f) => {
                  const sectionLabel = FIELD_TO_SECTION_LABEL[f.fieldName] ?? 'Other';
                  if (!bySection.has(sectionLabel)) bySection.set(sectionLabel, []);
                  bySection.get(sectionLabel)!.push(f);
                });
                return (
                  <Box sx={{ mb: examWithNotes.length ? 1 : 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      Abnormal findings
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {Array.from(bySection.entries()).map(([sectionLabel, findings]) => (
                        <Box key={sectionLabel}>
                          <Typography variant="body2" fontWeight={600}>
                            {sectionLabel}
                          </Typography>
                          <Stack spacing={0.25}>
                            {findings.map((f) => (
                              <Typography key={f.fieldName} variant="body2">
                                • {f.label}
                                {f.note ? ` — ${f.note}` : ''}
                              </Typography>
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                );
              })()}
            {examWithNotes
              .filter((f) => !abnormalExamFindings.find((a) => a.fieldName === f.fieldName))
              .map((f) => (
                <Typography key={f.fieldName} variant="body2">
                  • {FIELD_TO_SECTION_LABEL[f.fieldName] ? `${FIELD_TO_SECTION_LABEL[f.fieldName]}: ` : ''}
                  {f.label}: {f.note}
                </Typography>
              ))}
          </Section>
        )}

        {effectiveMdm && (
          <Section title="Medical Decision Making" amended={!!mdmAmend}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {effectiveMdm}
            </Typography>
          </Section>
        )}

        {allDiagnoses.length > 0 && (
          <Section title="Assessment / Diagnoses">
            <Stack spacing={0.5}>
              {allDiagnoses.map((d, i) => (
                <Stack key={`${d.code}-${i}`} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2">
                    <strong>{d.code}</strong> — {d.display}
                  </Typography>
                  {d.isPrimary && <Chip size="small" label="primary" sx={{ height: 18 }} />}
                </Stack>
              ))}
            </Stack>
          </Section>
        )}

        {sections.cptCodes.length > 0 && (
          <Section title="CPT Codes">
            <Stack spacing={0.25}>
              {sections.cptCodes.map((c) => (
                <Typography key={c.code} variant="body2">
                  <strong>{c.code}</strong> — {c.display}
                </Typography>
              ))}
            </Stack>
          </Section>
        )}

        {sections.emCode && (
          <Section title="E&M Code">
            <Typography variant="body2">
              <strong>{sections.emCode.code}</strong> — {sections.emCode.display}
            </Typography>
          </Section>
        )}

        {sections.patientInstructions.length > 0 && (
          <Section title="Patient Instructions">
            <Stack spacing={0.5}>
              {sections.patientInstructions.map((p, i) => (
                <Box key={i}>
                  {p.title && (
                    <Typography variant="body2" fontWeight={600}>
                      {p.title}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {p.text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Section>
        )}
      </Stack>
    </Paper>
  );
}
