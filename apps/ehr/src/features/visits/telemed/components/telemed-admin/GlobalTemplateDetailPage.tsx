import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
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
import { GLOBAL_TEMPLATES_URL } from 'src/App';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { QUERY_STALE_TIME } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';

interface ExamFinding {
  fieldName: string;
  label: string;
  isAbnormal: boolean;
  note: string;
}

interface DiagnosisInfo {
  code: string;
  display: string;
}

interface CodeInfo {
  code: string;
  display: string;
}

interface TemplateDetailData {
  templateName: string;
  templateId: string;
  examVersion: string;
  isCurrentVersion: boolean;
  sections: {
    hpiNote: string | null;
    moiNote: string | null;
    rosNote: string | null;
    examFindings: ExamFinding[];
    mdm: string | null;
    diagnoses: DiagnosisInfo[];
    patientInstructions: string | null;
    cptCodes: CodeInfo[];
    emCode: CodeInfo | null;
    accident: {
      autoAccident: boolean;
      employment: boolean;
      otherAccident: boolean;
      date?: string;
      state?: string;
    } | null;
  };
}

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
        const checkedMatch = line.match(/^[-*]\s*\[x\]\s*(.*)/i);
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

export default function GlobalTemplateDetailPage(): ReactElement {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const { data, isLoading, error } = useQuery<TemplateDetailData, Error>({
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
            { link: '/telemed-admin', children: 'Admin' },
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

          {/* Review of Systems */}
          <SectionCard title="Review of Systems (ROS)">
            {sections.rosNote ? renderMarkdown(sections.rosNote) : <NotIncluded />}
          </SectionCard>

          {/* Condition Related To */}
          <SectionCard title="Patient's Condition Related To">
            {sections.accident ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <FormControlLabel
                  control={<Checkbox checked={sections.accident.autoAccident} disabled size="small" />}
                  label={<Typography variant="body2">Auto Accident</Typography>}
                />
                <FormControlLabel
                  control={<Checkbox checked={sections.accident.employment} disabled size="small" />}
                  label={<Typography variant="body2">Employment</Typography>}
                />
                <FormControlLabel
                  control={<Checkbox checked={sections.accident.otherAccident} disabled size="small" />}
                  label={<Typography variant="body2">Other Accident</Typography>}
                />
                {sections.accident.date && (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                    Date: {sections.accident.date}
                  </Typography>
                )}
                {sections.accident.state && (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                    State: {sections.accident.state}
                  </Typography>
                )}
              </Box>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* Exam Findings */}
          <SectionCard title="Exam Findings">
            {sections.examFindings.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sections.examFindings.map((finding, index) => (
                      <TableRow key={index}>
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
                      <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
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
                      <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sections.cptCodes.map((cpt, index) => (
                      <TableRow key={index}>
                        <TableCell>{cpt.code}</TableCell>
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
                      <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
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
            {sections.patientInstructions ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sections.patientInstructions}
              </Typography>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>
        </Stack>
      </Box>
    </PageContainer>
  );
}
