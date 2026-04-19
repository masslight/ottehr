import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, CircularProgress, Typography } from '@mui/material';
import { QuestionnaireItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import {
  buildQuestionnairePages,
  evaluateCalculatedExpressions,
  formDataToResponseItem,
  QuestionnaireFormPage,
} from 'ui-components';
import { PageContainer } from '../components';
import { useUCZambdaClient, ZambdaClient } from '../hooks/useUCZambdaClient';

const GET_PM_ZAMBDA = 'get-practice-managed-questionnaires';
const SAVE_PM_ZAMBDA = 'save-practice-managed-response';

interface PracticeManagedQ {
  id: string;
  url: string;
  version?: string;
  title: string;
  item: QuestionnaireItem[];
  questionnaireResponseId?: string;
}

export const StandaloneFormPage: FC = () => {
  const { appointmentId, questionnaireId } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const [questionnaire, setQuestionnaire] = useState<PracticeManagedQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, any>>({});
  const [qrId, setQrId] = useState<string | undefined>(undefined);
  const [encounterId, setEncounterId] = useState<string>('');
  const [patientId, setPatientId] = useState<string>('');

  const methods = useForm();

  useEffect(() => {
    if (!zambdaClient || !appointmentId) return;

    const fetchData = async (): Promise<void> => {
      try {
        const response = await (zambdaClient as ZambdaClient).execute(GET_PM_ZAMBDA, {
          appointmentId,
          questionnaireId,
        });
        const data = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;

        if (data?.error === 'ACCESS_DENIED') {
          setAccessDeniedMessage(data.message);
          return;
        }

        const questionnaires = (data?.questionnaires || []) as PracticeManagedQ[];
        setEncounterId(data?.encounterId || '');
        setPatientId(data?.patientId || '');

        const current = questionnaires.find((q) => q.id === questionnaireId);
        if (current) {
          setQuestionnaire(current);
          setQrId(current.questionnaireResponseId);
        }
      } catch (err: any) {
        const errBody = err?.cause || err;
        if (errBody?.error === 'ACCESS_DENIED') {
          setAccessDeniedMessage(errBody.message);
        } else {
          console.error('Failed to fetch questionnaire:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [zambdaClient, appointmentId, questionnaireId]);

  const pages = useMemo(
    () => buildQuestionnairePages(questionnaire?.item || [], questionnaire?.title),
    [questionnaire]
  );
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex >= pages.length - 1;

  const handleSubmit = useCallback(
    async (data: Record<string, any>) => {
      if (!zambdaClient || !questionnaire || !currentPage) return;

      setSaving(true);
      try {
        const updatedAnswers = { ...allAnswers, ...data };
        setAllAnswers(updatedAnswers);

        const pageItem = formDataToResponseItem(data, currentPage);

        const response = await (zambdaClient as ZambdaClient).execute(SAVE_PM_ZAMBDA, {
          questionnaireResponseId: qrId,
          questionnaireUrl: questionnaire.url,
          questionnaireVersion: questionnaire.version,
          encounterId,
          patientId,
          pageIndex: currentPageIndex,
          answers: pageItem,
        });
        const result = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;

        const currentQrId = result?.questionnaireResponseId || qrId;
        if (currentQrId) {
          setQrId(currentQrId);
        }

        if (!isLastPage) {
          setCurrentPageIndex((prev) => prev + 1);
          methods.reset();
        } else {
          // Evaluate calculated expressions and save computed values
          const qItems = questionnaire.item || [];
          const computedValues = evaluateCalculatedExpressions(qItems, updatedAnswers);
          const computedEntries = Object.entries(computedValues).filter(([, v]) => v !== undefined);

          if (computedEntries.length > 0) {
            const computedQrItems = computedEntries.map(([linkId, value]) => ({
              linkId,
              answer: [
                typeof value === 'boolean'
                  ? { valueBoolean: value }
                  : typeof value === 'number'
                  ? { valueDecimal: value }
                  : { valueString: String(value) },
              ],
            }));

            await (zambdaClient as ZambdaClient).execute(SAVE_PM_ZAMBDA, {
              questionnaireResponseId: currentQrId,
              questionnaireUrl: questionnaire.url,
              questionnaireVersion: questionnaire.version,
              encounterId,
              patientId,
              pageIndex: currentPageIndex + 1,
              answers: { linkId: 'results', item: computedQrItems },
            });
          }

          setCompleted(true);
        }
      } catch (err) {
        console.error('Failed to save response:', err);
      } finally {
        setSaving(false);
      }
    },
    [
      zambdaClient,
      questionnaire,
      currentPage,
      qrId,
      encounterId,
      patientId,
      currentPageIndex,
      isLastPage,
      methods,
      allAnswers,
    ]
  );

  if (loading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (accessDeniedMessage) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {accessDeniedMessage}
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!questionnaire || !currentPage) {
    return (
      <PageContainer>
        <Typography color="error" sx={{ p: 3 }}>
          Form not found.
        </Typography>
      </PageContainer>
    );
  }

  if (completed) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F347C', mb: 1 }}>
            Form Submitted
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Thank you for completing {questionnaire.title}. You may close this page.
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <QuestionnaireFormPage
        page={currentPage}
        title={currentPage.text || questionnaire.title}
        subtitle={questionnaire.title}
        methods={methods}
        onSubmit={handleSubmit}
        onBack={
          currentPageIndex > 0
            ? () => {
                setCurrentPageIndex((prev) => prev - 1);
                methods.reset();
              }
            : undefined
        }
        isLastPage={isLastPage}
        saving={saving}
        submitLabel={isLastPage ? 'Submit' : 'Continue'}
      />
    </PageContainer>
  );
};

export default StandaloneFormPage;
