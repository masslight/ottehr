import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { QuestionnaireItem } from 'fhir/r4b';
// import { QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import {
  buildQuestionnairePages,
  // evaluateCalculatedExpressions,
  formDataToResponseItem,
  QuestionnaireFormPage,
  responseItemsToFormValues,
} from 'ui-components';
import { APIError, isApiError, NO_READ_ACCESS_TO_PATIENT_ERROR } from 'utils';
import api from '../api/ottehrApi';
import { PageContainer } from '../components';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

// const GET_PM_ZAMBDA = 'get-managed-paperwork';
// const SAVE_PM_ZAMBDA = 'save-practice-managed-response';
// const FINALIZE_PM_ZAMBDA = 'finalize-practice-managed-response';

enum AuthedLoadingState {
  initial,
  loading,
  complete,
  noReadAccess,
}

// interface PracticeManagedQ {
//   id: string;
//   url: string;
//   title: string;
//   item: QuestionnaireItem[];
//   questionnaireResponseId?: string;
//   questionnaireResponseItems?: QuestionnaireResponseItem[];
// }

export const StandaloneFormPage: FC = () => {
  const { appointmentId, questionnaireId } = useParams();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const [questionnaireTitle, setQuestionnaireTitle] = useState<string | undefined>(undefined);
  const [questionnaireItems, setQuestionnaireItems] = useState<QuestionnaireItem[] | null>(null);
  // const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // const [complete, setComplete] = useState(false);
  // const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, any>>({}); // todo sarah we need typing here
  const [authedFetchState, setAuthedFetchState] = useState(AuthedLoadingState.initial);

  const methods = useForm();

  useEffect(() => {
    if (!zambdaClient || !appointmentId || authedFetchState !== AuthedLoadingState.initial || !questionnaireId) return;

    const fetchManagedPaperwork = async (): Promise<void> => {
      try {
        setAuthedFetchState(AuthedLoadingState.loading);
        const response = await api.getManagedPaperwork(zambdaClient, { appointmentId, questionnaireId });
        setQuestionnaireTitle(response.managedPaperwork.questionnaireTitle);
        setQuestionnaireItems(response.managedPaperwork.questionnaireItems);

        if (response.managedPaperwork.questionnaireResponse?.item) {
          const resumed = responseItemsToFormValues(response.managedPaperwork.questionnaireResponse?.item);
          console.log('resumed', resumed); // todo sarah remove
          if (Object.keys(resumed).length > 0) {
            setAllAnswers(resumed);
            methods.reset(resumed);
          }
        }

        // const current = questionnaires.find((q) => q.id === questionnaireId);
        // if (current) {
        //   setQuestionnaire(current);
        //   // Resume an in-progress response — without seeding, page saves would
        //   // silently overwrite the previously-entered answers.
        //   const resumed = responseItemsToFormValues(current.questionnaireResponseItems);
        //   if (Object.keys(resumed).length > 0) {
        //     setAllAnswers(resumed);
        //     methods.reset(resumed);
        //   }
        // }
      } catch (e) {
        if (isApiError(e)) {
          const apiError = e as APIError;
          if (apiError.code === NO_READ_ACCESS_TO_PATIENT_ERROR.code) {
            setAuthedFetchState(AuthedLoadingState.noReadAccess);
          }
        }
      } finally {
        setAuthedFetchState(AuthedLoadingState.complete);
      }
    };

    void fetchManagedPaperwork();
  }, [zambdaClient, appointmentId, questionnaireId, authedFetchState, methods]);

  const pages = useMemo(
    () => buildQuestionnairePages(questionnaireItems || [], questionnaireTitle),
    [questionnaireItems, questionnaireTitle]
  );
  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex === pages.length - 1;
  const submitted = currentPageIndex > pages.length - 1;

  // Restore previously-entered answers on page change so Back doesn't blank the form.
  const allAnswersRef = useRef(allAnswers);
  allAnswersRef.current = allAnswers;
  useEffect(() => {
    methods.reset(allAnswersRef.current);
  }, [currentPageIndex, methods]);

  console.log('isLastPage', isLastPage, currentPageIndex, pages.length - 1);

  const handleSubmit = useCallback(
    async (data: Record<string, any>) => {
      if (!zambdaClient || !questionnaireId || !currentPage || !appointmentId) return;

      setSaving(true);
      setSaveError(false);
      try {
        const updatedAnswers = { ...allAnswers, ...data };
        setAllAnswers(updatedAnswers);

        const pageItem = formDataToResponseItem(data, currentPage);

        await api.saveManagedPaperworkResponse(zambdaClient, {
          pageAnswers: pageItem,
          questionnaireId,
          complete: isLastPage,
          appointmentId,
        });

        setCurrentPageIndex((prev) => prev + 1);

        // if (!isLastPage) {
        //   setCurrentPageIndex((prev) => prev + 1);
        // } else {
        // todo sarah gotta come back to this
        // Evaluate calculated expressions and save computed values
        // const qItems = questionnaire.item || [];
        // const computedValues = evaluateCalculatedExpressions(qItems, updatedAnswers);
        // const computedEntries = Object.entries(computedValues).filter(([, v]) => v !== undefined);
        // if (computedEntries.length > 0) {
        //   const computedQrItems = computedEntries.map(([linkId, value]) => ({
        //     linkId,
        //     answer: [
        //       typeof value === 'boolean'
        //         ? { valueBoolean: value }
        //         : typeof value === 'number'
        //         ? { valueDecimal: value }
        //         : { valueString: String(value) },
        //     ],
        //   }));
        //   await (zambdaClient as ZambdaClient).execute(SAVE_PM_ZAMBDA, {
        //     questionnaireResponseId: currentQrId,
        //     questionnaireUrl: questionnaire.url,
        //     pageIndex: currentPageIndex + 1,
        //     answers: { linkId: 'results', item: computedQrItems },
        //   });
        // }
        // // Finalize: mark complete, render PDF, and file into the patient's Paperwork folder.
        // // A finalize failure propagates to the outer catch — the patient must NOT see
        // // "Form Submitted" when the form never completed; Submit can be pressed again.
        // if (currentQrId) {
        //   await (zambdaClient as ZambdaClient).execute(FINALIZE_PM_ZAMBDA, {
        //     questionnaireResponseId: currentQrId,
        //   });
        // }
        // }
      } catch (err) {
        // Stay on the page and tell the patient — a silent failure looks like a dead
        // Submit button and risks the patient closing the tab thinking they're done.
        console.error('Failed to save response:', err);
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    },
    [zambdaClient, currentPage, isLastPage, allAnswers, questionnaireId, appointmentId]
  );

  if (authedFetchState === AuthedLoadingState.initial || authedFetchState === AuthedLoadingState.loading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  // todo sarah i think this should just redirect the user to the home page
  // or maybe prompt them to log in again? i dunno
  if (authedFetchState === AuthedLoadingState.noReadAccess) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            Access Denied
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!questionnaireItems) {
    return (
      <PageContainer>
        <Typography color="error" sx={{ p: 3 }}>
          Form not found.
        </Typography>
      </PageContainer>
    );
  }

  if (submitted) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F347C', mb: 1 }}>
            Form Submitted
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Thank you for completing {questionnaireTitle}. You may close this page.
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(false)}>
          We couldn't save your answers. Please check your connection and try again.
        </Alert>
      )}
      <QuestionnaireFormPage
        page={currentPage}
        title={currentPage.text || questionnaireTitle}
        subtitle={questionnaireTitle}
        methods={methods}
        onSubmit={handleSubmit}
        onBack={currentPageIndex > 0 ? () => setCurrentPageIndex((prev) => prev - 1) : undefined}
        isLastPage={isLastPage}
        saving={saving}
        submitLabel={isLastPage ? 'Submit' : 'Continue'}
      />
    </PageContainer>
  );
};

export default StandaloneFormPage;
