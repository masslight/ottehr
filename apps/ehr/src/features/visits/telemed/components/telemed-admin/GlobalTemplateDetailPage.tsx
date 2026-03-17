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
import { GLOBAL_TEMPLATES_URL } from 'src/App';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { QUERY_STALE_TIME } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';

interface ExamFinding {
  fieldName: string;
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
  sections: {
    hpiNote: string | null;
    rosNote: string | null;
    examFindings: ExamFinding[];
    mdm: string | null;
    diagnoses: DiagnosisInfo[];
    patientInstructions: string | null;
    cptCodes: CodeInfo[];
    emCode: CodeInfo | null;
  };
}

function formatFieldName(fieldName: string): string {
  return fieldName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
            label={data.examVersion ? 'Current' : 'Stale'}
            color={data.examVersion ? 'success' : 'warning'}
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

          {/* Review of Systems */}
          <SectionCard title="Review of Systems">
            {sections.rosNote ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sections.rosNote}
              </Typography>
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
                        <TableCell>{formatFieldName(finding.fieldName)}</TableCell>
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
          <SectionCard title="Assessment / Diagnoses">
            {sections.diagnoses.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>ICD-10 Code</TableCell>
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

          {/* CPT Codes */}
          <SectionCard title="CPT Codes">
            {sections.cptCodes.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {sections.cptCodes.map((cpt, index) => (
                  <Chip key={index} label={`${cpt.code}${cpt.display ? ` - ${cpt.display}` : ''}`} variant="outlined" />
                ))}
              </Box>
            ) : (
              <NotIncluded />
            )}
          </SectionCard>

          {/* E&M Code */}
          <SectionCard title="E&M Code">
            {sections.emCode ? (
              <Chip
                label={`${sections.emCode.code}${sections.emCode.display ? ` - ${sections.emCode.display}` : ''}`}
                variant="outlined"
              />
            ) : (
              <NotIncluded />
            )}
          </SectionCard>
        </Stack>
      </Box>
    </PageContainer>
  );
}
