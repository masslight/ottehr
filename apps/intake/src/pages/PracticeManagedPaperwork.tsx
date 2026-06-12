import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import {
  buildQuestionnairePages,
  formDataToResponseItem,
  QuestionnaireFormPage,
  responseItemsToFormValues,
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
  questionnaireResponseStatus?: string;
  questionnaireResponseItems?: QuestionnaireResponseItem[];
}

export const PracticeManagedPaperwork: FC = () => {
  const params = useParams();
  const appointmentId = params.id;
  const questionnaireId = params.questionnaireId;
  const returnSlug = params.returnSlug || 'review';
  const navigate = useNavigate();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const [questionnaire, setQuestionnaire] = useState<PracticeManagedQ | null>(null);
  const [allPmQuestionnaires, setAllPmQuestionnaires] = useState<PracticeManagedQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, any>>({});
  const [qrId, setQrId] = useState<string | undefined>(undefined);
  const [encounterId, setEncounterId] = useState<string>('');
  const [patientId, setPatientId] = useState<string>('');

  const methods = useForm();

  // Fetch practice-managed questionnaires.
  // Clear state up front so route transitions (custom/<idA> → custom/<idB>) don't briefly
  // render the previous PM Q's pages indexed by the new currentPageIndex, which would
  // flash "Questionnaire not found" before the new fetch resolves.
  useEffect(() => {
    if (!zambdaClient || !appointmentId) return;

    setLoading(true);
    setQuestionnaire(null);
    setQrId(undefined);
    setCurrentPageIndex(0);
    setAllAnswers({});
    // Also clear the RHF store: the page-change reset effect won't fire when the index is
    // already 0, so without this the previous questionnaire's values survive a
    // custom/<idA> → custom/<idB> navigation and get submitted into the new QR.
    methods.reset({});

    const fetchData = async (): Promise<void> => {
      try {
        const response = await (zambdaClient as ZambdaClient).execute(GET_PM_ZAMBDA, { appointmentId });
        const data = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;
        const questionnaires = (data?.questionnaires || []) as PracticeManagedQ[];
        setAllPmQuestionnaires(questionnaires);
        setEncounterId(data?.encounterId || '');
        setPatientId(data?.patientId || '');

        const current = questionnaires.find((q) => q.id === questionnaireId);
        if (current) {
          setQuestionnaire(current);
          setQrId(current.questionnaireResponseId);
          // Resume an in-progress response — without seeding, page saves would
          // silently overwrite the previously-entered answers.
          const resumed = responseItemsToFormValues(current.questionnaireResponseItems);
          if (Object.keys(resumed).length > 0) {
            setAllAnswers(resumed);
            methods.reset(resumed);
          }
        }
      } catch (err) {
        console.error('Failed to fetch practice-managed questionnaires:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    // methods is stable (useForm return identity) — included for lint completeness.
  }, [zambdaClient, appointmentId, questionnaireId, methods]);

  const pages = useMemo(
    () => buildQuestionnairePages(questionnaire?.item || [], questionnaire?.title),
    [questionnaire]
  );
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex >= pages.length - 1;

  // Restore previously-entered answers on page change so Back doesn't blank the form.
  const allAnswersRef = useRef(allAnswers);
  allAnswersRef.current = allAnswers;
  useEffect(() => {
    methods.reset(allAnswersRef.current);
  }, [currentPageIndex, methods]);

  const handleSubmit = useCallback(
    async (data: Record<string, any>) => {
      if (!zambdaClient || !questionnaire || !currentPage) return;

      setSaving(true);
      setSaveError(false);
      try {
        setAllAnswers((prev) => ({ ...prev, ...data }));
        const pageItem = formDataToResponseItem(data, currentPage);

        const response = await (zambdaClient as ZambdaClient).execute(SAVE_PM_ZAMBDA, {
          questionnaireResponseId: qrId,
          questionnaireUrl: questionnaire.url,
          questionnaireVersion: questionnaire.version,
          encounterId,
          patientId,
          pageIndex: currentPageIndex,
          answers: pageItem,
          // Final page completes the QR — the intake's insertion check keys off
          // questionnaireResponseStatus === 'completed' to stop re-entering this form.
          complete: isLastPage,
        });
        const result = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;

        if (result?.questionnaireResponseId) {
          setQrId(result.questionnaireResponseId);
        }

        if (!isLastPage) {
          setCurrentPageIndex((prev) => prev + 1);
        } else {
          const currentIdx = allPmQuestionnaires.findIndex((q) => q.id === questionnaireId);
          const nextPmQ = allPmQuestionnaires[currentIdx + 1];
          if (nextPmQ) {
            navigate(`/paperwork/${appointmentId}/custom/${nextPmQ.id}/${returnSlug}`);
          } else {
            navigate(`/paperwork/${appointmentId}/${returnSlug}`);
          }
        }
      } catch (err) {
        // Stay on the page and tell the patient — a silent failure here looks like a
        // dead Continue button and loses their answers if they close the tab.
        console.error('Failed to save practice-managed response:', err);
        setSaveError(true);
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
      allPmQuestionnaires,
      questionnaireId,
      appointmentId,
      returnSlug,
      navigate,
    ]
  );

  const handleBack = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    } else {
      const currentIdx = allPmQuestionnaires.findIndex((q) => q.id === questionnaireId);
      if (currentIdx > 0) {
        const prevPmQ = allPmQuestionnaires[currentIdx - 1];
        navigate(`/paperwork/${appointmentId}/custom/${prevPmQ.id}/${returnSlug}`);
      } else {
        navigate(-1);
      }
    }
  }, [currentPageIndex, allPmQuestionnaires, questionnaireId, appointmentId, returnSlug, navigate]);

  if (loading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (!questionnaire || !currentPage) {
    return (
      <PageContainer>
        <Typography color="error" sx={{ p: 3 }}>
          Questionnaire not found.
        </Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(false)}>
          We couldn't save your answers. Please check your connection and press Continue again.
        </Alert>
      )}
      <QuestionnaireFormPage
        page={currentPage}
        title={currentPage.text || questionnaire.title}
        subtitle={questionnaire.title}
        methods={methods}
        onSubmit={handleSubmit}
        onBack={handleBack}
        isLastPage={isLastPage}
        saving={saving}
        submitLabel="Continue"
      />
    </PageContainer>
  );
};

export default PracticeManagedPaperwork;
