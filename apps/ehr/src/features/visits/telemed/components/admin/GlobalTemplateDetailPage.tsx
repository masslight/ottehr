import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTemplateDetail } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { QUERY_STALE_TIME } from 'src/constants';
import { GLOBAL_TEMPLATES_URL } from 'src/features/admin/adminRoutes';
import { formatCptCodeAndModifiersForDisplay, getProcedureDisplayFields } from 'src/helpers/templates';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import {
  AdminGetTemplateDetailOutput,
  groupExamFindingsBySection,
  nameLabTest,
  RosFindingState,
  RosFindingStateLabel,
  TemplateExamFinding,
  TemplateRosFinding,
} from 'utils';

function renderMarkdown(text: string): ReactElement {
  // Convert markdown task lists and basic formatting to HTML-like rendering
  const lines = text.split('\n');
  return (
    <Box
      sx={{
        '& ul': { listStyle: 'none', pl: 0 },
        '& li': { display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 },
      }}
    >
      {lines.map((line, i) => {
        // Match markdown checked checkbox: "- [x] item" or "* [x] item" (case-insensitive)
        const checkedMatch = line.match(/^[-*]\s*\[x\]\s*(.*)/i);
        // Match markdown unchecked checkbox: "- [ ] item" or "* [ ] item"
        const uncheckedMatch = line.match(/^[-*]\s*\[\s*\]\s*(.*)/);
        if (checkedMatch) {
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <input type="checkbox" checked disabled style={{ width: 16, height: 16 }} />
              <Typography variant="body2">{checkedMatch[1]}</Typography>
            </Box>
          );
        }
        if (uncheckedMatch) {
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <input type="checkbox" disabled style={{ width: 16, height: 16 }} />
              <Typography variant="body2">{uncheckedMatch[1]}</Typography>
            </Box>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Typography key={i} variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
              {line.slice(2)}
            </Typography>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Typography key={i} variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
              {line.slice(3)}
            </Typography>
          );
        }
        if (line.trim() === '') {
          return <Box key={i} sx={{ height: 8 }} />;
        }
        return (
          <Typography key={i} variant="body2">
            {line}
          </Typography>
        );
      })}
    </Box>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactElement | string }): ReactElement {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function NotIncluded(): ReactElement {
  return (
    <Typography variant="body2" color="text.secondary" fontStyle="italic">
      Not included in this template
    </Typography>
  );
}

function ExamFindingsTable({ findings }: { findings: TemplateExamFinding[] }): ReactElement {
  const groups = groupExamFindingsBySection(findings);
  return (
    <Stack spacing={2}>
      {groups.map((group) => (
        <Box key={group.sectionKey}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {group.sectionLabel}
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '60%' }}>Field</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.findings.map((finding, index) => (
                  <TableRow key={`${finding.fieldName}-${index}`}>
                    <TableCell>{finding.label}</TableCell>
                    <TableCell>
                      <Chip
                        label={finding.isAbnormal ? 'Abnormal' : 'Normal'}
                        size="small"
                        color={finding.isAbnormal ? 'error' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap' }}>
                      {finding.note || (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Stack>
  );
}

function RosFindingsTable({ findings }: { findings: TemplateRosFinding[] }): ReactElement {
  return (
    <TableContainer>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold', width: '60%' }}>Field</TableCell>
            <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 'bold', width: '30%' }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {findings.map(({ label, findingState, stale }, index) => {
            const statusLabel = findingState ? RosFindingStateLabel[findingState] : 'unknown';
            return (
              <TableRow key={index}>
                <TableCell>{label}</TableCell>
                <TableCell sx={{ display: 'flex' }}>
                  <Chip
                    label={statusLabel}
                    size="small"
                    color={
                      findingState === RosFindingState.Reports
                        ? 'error'
                        : findingState === RosFindingState.Denies
                          ? 'success'
                          : 'warning'
                    }
                    variant="outlined"
                  />
                  {stale ? <Chip label="Stale" size="small" color="warning" sx={{ ml: 1 }} /> : null}
                </TableCell>
                <TableCell />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function GlobalTemplateDetailPage(): ReactElement {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const { data, isLoading, error } = useQuery<AdminGetTemplateDetailOutput, Error>({
    queryKey: ['template-detail', templateId],
    queryFn: async () => {
      if (!oystehrZambda || !templateId) {
        throw new Error('API client or template ID not available');
      }
      return await getTemplateDetail(oystehrZambda, { templateId });
    },
    enabled: !!oystehrZambda && !!templateId,
    staleTime: QUERY_STALE_TIME,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <Box sx={{ mt: 3 }}>
          <Alert severity="error">{error?.message ?? 'Failed to load template details'}</Alert>
        </Box>
      </PageContainer>
    );
  }

  const { sections } = data;

  return (
    <PageContainer>
      <Box sx={{ mt: 3 }}>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: GLOBAL_TEMPLATES_URL, children: 'Global Templates' },
            { link: '#', children: data.templateName },
          ]}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, mb: 3 }}>
          <IconButton onClick={() => navigate(GLOBAL_TEMPLATES_URL)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {data.templateName}
          </Typography>
          <Chip
            label={data.isCurrentVersion ? 'Current' : 'Stale'}
            color={data.isCurrentVersion ? 'success' : 'warning'}
            size="small"
            sx={{ ml: 1 }}
          />
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          To update this template, use a test patient, apply this template, make any changes, and save them with the
          template menu.
        </Alert>

        <Stack spacing={3}>
          {/* HPI */}
          <SectionCard title="HPI">
            {sections.hpiNote ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sections.hpiNote}
              </Typography>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Mechanism of Injury */}
          <SectionCard title="Mechanism of Injury (MOI)">
            {sections.moiNote ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sections.moiNote}
              </Typography>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Review of Systems - Legacy */}
          {sections.rosNote ? (
            <SectionCard title="Review of Systems (ROS) (Legacy)">{renderMarkdown(sections.rosNote)}</SectionCard>
          ) : null}

          {/* Review of Systems */}
          <SectionCard title="Review of Systems (ROS)">
            {sections.rosFindings.length ? <RosFindingsTable findings={sections.rosFindings} /> : <NotIncluded />}
          </SectionCard>

          {/* Exam Findings */}
          <SectionCard title="Exam Findings">
            {sections.examFindings.length > 0 ? (
              <ExamFindingsTable findings={sections.examFindings} />
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Medical Decision Making */}
          <SectionCard title="Medical Decision Making">
            {sections.mdm ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sections.mdm}
              </Typography>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Assessment / Diagnoses */}
          <SectionCard title="Assessment / ICD-10 Diagnoses">
            {sections.diagnoses.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sections.diagnoses.map((diagnosis, index) => (
                      <TableRow key={index}>
                        <TableCell>{diagnosis.code}</TableCell>
                        <TableCell>{diagnosis.display}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* CPT Codes */}
          <SectionCard title="CPT Codes">
            {sections.cptCodes.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sections.cptCodes.map((cpt, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatCptCodeAndModifiersForDisplay(cpt)}</TableCell>
                        <TableCell>{cpt.display || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* E&M Code */}
          <SectionCard title="E&M Code">
            {sections.emCode ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>{sections.emCode.code}</TableCell>
                      <TableCell>{sections.emCode.display || '—'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Patient Instructions */}
          <SectionCard title="Patient Instructions">
            {sections.patientInstructions.length > 0 ? (
              <Stack spacing={2}>
                {sections.patientInstructions.map((instruction, index) => (
                  <Box key={index}>
                    {instruction.title && (
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {instruction.title}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {instruction.text}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* In-House Lab Orders */}
          <SectionCard title="In-House Lab Orders">
            {sections.inHouseLabs.length > 0 ? (
              <Stack spacing={2}>
                {sections.inHouseLabs.map((plan) => (
                  <Box key={plan.planId} sx={{ opacity: plan.missing ? 0.6 : 1 }}>
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {plan.testName}
                      </Typography>
                      {plan.missing ? (
                        <Typography variant="caption" color="warning.main" fontStyle="italic">
                          ActivityDefinition not found in this environment — applies will skip this lab
                        </Typography>
                      ) : null}
                    </Stack>
                    {plan.diagnoses.length > 0 ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>Diagnoses:</strong>{' '}
                        {plan.diagnoses.map((d) => (d.display ? `${d.code} — ${d.display}` : d.code)).join('; ')}
                      </Typography>
                    ) : null}
                    {plan.notes.length > 0 ? (
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                        <strong>Notes:</strong> {plan.notes.join('\n\n')}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* External Lab Orders */}
          <SectionCard title="External Lab Orders">
            {sections.externalLabs.length > 0 ? (
              <Stack spacing={2}>
                {sections.externalLabs.map((plan) => (
                  <Box key={plan.planId} sx={{ opacity: plan.missing ? 0.6 : 1 }}>
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {nameLabTest(plan.testName, plan.testCode, plan.labName, false)}
                      </Typography>
                      {plan.missing ? (
                        <Typography variant="caption" color="warning.main" fontStyle="italic">
                          Test not found in the lab's compendium — applies will skip this order
                        </Typography>
                      ) : null}
                    </Stack>
                    {plan.diagnoses.length > 0 ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>Diagnoses:</strong>{' '}
                        {plan.diagnoses.map((d) => (d.display ? `${d.code} — ${d.display}` : d.code)).join('; ')}
                      </Typography>
                    ) : null}
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>PSC Hold:</strong> {plan.psc ? 'Yes' : 'No'}
                    </Typography>
                    {plan.note ? (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        <strong>Note:</strong> {plan.note}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Procedures */}
          <SectionCard title="Procedures">
            {sections.procedures.length > 0 ? (
              <Stack spacing={2}>
                {sections.procedures.map((plan) => (
                  <Box key={plan.planId}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {plan.procedureType ?? plan.cptCodes[0]?.display ?? plan.cptCodes[0]?.code ?? 'Procedure'}
                    </Typography>
                    {plan.cptCodes.length > 0 ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>CPT codes:</strong>{' '}
                        {plan.cptCodes
                          .map((c) => {
                            const label = formatCptCodeAndModifiersForDisplay(c);
                            return c.display ? `${label} — ${c.display}` : label;
                          })
                          .join('; ')}
                      </Typography>
                    ) : null}
                    {plan.diagnoses.length > 0 ? (
                      <Typography variant="body2">
                        <strong>Diagnoses:</strong>{' '}
                        {plan.diagnoses.map((d) => (d.display ? `${d.code} — ${d.display}` : d.code)).join('; ')}
                      </Typography>
                    ) : null}
                    {getProcedureDisplayFields(plan).map((f) => (
                      <Typography
                        key={f.label}
                        variant="body2"
                        sx={f.multiline ? { whiteSpace: 'pre-wrap' } : undefined}
                      >
                        <strong>{f.label}:</strong> {f.value}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Stack>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* In-House Medication Orders */}
          <SectionCard title="In-House Medication Orders">
            {sections.inHouseMedications.length > 0 ? (
              <Stack spacing={2}>
                {sections.inHouseMedications.map((med) => (
                  <Box key={med.planId}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {med.medicationName}
                    </Typography>
                    {med.dose !== undefined || med.units || med.route ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {[
                          med.dose !== undefined ? String(med.dose) : null,
                          med.units,
                          med.route ? `via ${med.route}` : null,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </Typography>
                    ) : null}
                    {med.instructions ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>Instructions:</strong> {med.instructions}
                      </Typography>
                    ) : null}
                    {med.diagnoses.length > 0 ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>Diagnoses:</strong>{' '}
                        {med.diagnoses.map((d) => (d.display ? `${d.code} — ${d.display}` : d.code)).join('; ')}
                      </Typography>
                    ) : null}
                    {med.cptCodes.length > 0 ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>CPT codes:</strong>{' '}
                        {med.cptCodes
                          .map((c) => {
                            const label = formatCptCodeAndModifiersForDisplay(c);
                            return c.display ? `${label} — ${c.display}` : label;
                          })
                          .join('; ')}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>
        </Stack>
      </Box>
    </PageContainer>
  );
}
