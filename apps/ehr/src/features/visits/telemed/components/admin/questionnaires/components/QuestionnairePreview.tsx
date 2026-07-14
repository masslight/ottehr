import { Box, Typography, useTheme } from '@mui/material';
import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, SetStateAction, useEffect, useMemo, useState } from 'react';
import { QuestionnaireResponseViewer } from 'src/components/QuestionnaireResponseViewer';
import { PagedQuestionnaire, PaperworkProvider } from 'ui-components';
import {
  convertQRItemToLinkIdMap,
  convertQuestionnaireItemToQRLinkIdMap,
  makeStandaloneFormDTO,
  QuestionnaireFormFields,
} from 'utils';
import { stubPaperworkContext, stubPaperworkResponseForPreview } from '../questionnaire-utils';

interface QuestionnairePreviewProps {
  questionnaire: Questionnaire;
  currentPageIndex: number;
  setCurrentPageIndex: (value: SetStateAction<number>) => void;
  completed: boolean;
  setCompleted: (value: SetStateAction<boolean>) => void;
  // full will enforce validation schema while ui-only lets users quickly flip through pages without entering data
  previewMode: 'ui-only' | 'full';
}

export const QuestionnairePreview: FC<QuestionnairePreviewProps> = ({
  questionnaire,
  currentPageIndex,
  setCurrentPageIndex,
  completed,
  setCompleted,
  previewMode,
}) => {
  const [continueLabel, setContinueLabel] = useState<string | undefined>('Continue');
  const [answersByPage, setAnswersByPage] = useState<Record<string, QuestionnaireResponseItem[]>>({});

  const theme = useTheme();

  const { allItems, questionnaireResponse, questionnaireTitle } = stubPaperworkResponseForPreview(questionnaire);

  const liveQuestionnaireResponse = useMemo(() => {
    return {
      ...questionnaireResponse,
      item: questionnaireResponse.item?.map((page) => ({
        ...page,
        item: answersByPage[page.linkId ?? ''] ?? page.item,
      })),
    };
  }, [questionnaireResponse, answersByPage]);

  const pages = useMemo(() => {
    return (allItems ?? []).filter((item) => {
      return item.linkId;
    });
  }, [allItems]);

  const stubContext = useMemo(
    () => stubPaperworkContext(pages, allItems, liveQuestionnaireResponse, setContinueLabel, continueLabel),
    [pages, allItems, liveQuestionnaireResponse, continueLabel]
  );

  const { currentPage, isLastPage } = useMemo(() => {
    const currentPage = pages[currentPageIndex]; // this will be undefined when we finish the form
    const isLastPage = currentPageIndex === pages.length - 1;

    return { currentPage, isLastPage };
  }, [pages, currentPageIndex]);

  useEffect(() => {
    if (isLastPage) {
      setContinueLabel('Submit');
    } else {
      setContinueLabel('Continue'); // allows control buttons to fall back to the default
    }
  }, [isLastPage, setContinueLabel]);

  const paperworkGroupDefaults = useMemo(() => {
    const currentPageFields = convertQuestionnaireItemToQRLinkIdMap(currentPage?.item);
    const currentPageEntries = liveQuestionnaireResponse.item?.find((item) => item.linkId === currentPage?.linkId)
      ?.item;
    if (!currentPageEntries) {
      return { ...currentPageFields };
    }

    const pageDefaults = convertQRItemToLinkIdMap(currentPageEntries);

    return { ...currentPageFields, ...pageDefaults };
  }, [liveQuestionnaireResponse, currentPage]);

  const controlButtons = useMemo(
    () => ({
      backButton: currentPageIndex !== 0,
      onBack: () => setCurrentPageIndex((prev) => prev - 1), // todo sarah i think setComplete needs to be handled here too
      loading: false, // no concept of loading here since nothing is being saved to the server
    }),
    [currentPageIndex, setCurrentPageIndex]
  );

  const handleContinue = (data: QuestionnaireFormFields): void => {
    if (currentPage?.linkId) {
      setAnswersByPage((prev) => ({ ...prev, [currentPage.linkId]: Object.values(data) }));
    }
    if (isLastPage) {
      setCompleted(true);
      return;
    }
    setCurrentPageIndex((prev) => prev + 1);
  };

  const formattedFormResponse = useMemo(() => {
    return makeStandaloneFormDTO(questionnaire, liveQuestionnaireResponse);
  }, [questionnaire, liveQuestionnaireResponse]);

  if (pages.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        Add items to see the form preview.
      </Typography>
    );
  }

  if (completed && previewMode === 'full') {
    return (
      <Box>
        <Typography variant="h6" sx={{ color: '#0F347C', fontWeight: 700, mb: 2 }}>
          Form Complete
        </Typography>
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Patient answers submitted:
          </Typography>
          <Box
            sx={{
              bgcolor: '#F5F5F5',
              borderRadius: '8px',
              p: 2,
              fontFamily: 'monospace',
              fontSize: 12,
              maxHeight: 400,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            <QuestionnaireResponseViewer form={formattedFormResponse} />
          </Box>
        </>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          bgcolor: '#F5F5F5',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 3,
          px: 2,
          // Scale the patient-width form down to fit the builder's preview column.
          transform: 'scale(0.75)',
          transformOrigin: 'top left',
          width: '133.33%',
        }}
      >
        {/* Page progress indicator — click a segment to jump to that page */}
        {previewMode === 'ui-only' && pages.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.5, width: '100%', maxWidth: 900, mb: 2 }}>
            {pages.map((_, idx) => (
              <Box
                key={idx}
                onClick={() => setCurrentPageIndex(idx)}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: idx <= currentPageIndex ? theme.palette.primary.main : '#E0E0E0',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              />
            ))}
          </Box>
        )}

        <Box
          sx={{
            width: '100%',
            maxWidth: 900,
            bgcolor: theme.palette.primary.contrastText,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: '#E0E0E0',
            boxShadow: '0px 1px 3px rgba(0,0,0,0.08)',
            p: { xs: 3, md: 5 },
          }}
        >
          <PaperworkProvider value={stubContext}>
            <PagedQuestionnaire
              onSubmit={handleContinue}
              pageId={currentPage?.linkId ?? ''}
              pageItem={currentPage}
              pageSubtitle={questionnaireTitle}
              options={{ controlButtons }}
              items={currentPage.item ?? []}
              defaultValues={paperworkGroupDefaults}
              saveProgress={() => {}}
              skipValidation={previewMode === 'ui-only'}
            />
          </PaperworkProvider>

          {previewMode === 'ui-only' && pages.length > 1 && (
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1, color: '#4F4F4F' }}>
              Page {currentPageIndex + 1} of {pages.length}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
