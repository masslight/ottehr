import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useCallback, useMemo, useState } from 'react';
import {
  evaluateCalculatedExpressions,
  PagedQuestionnaire,
  PaperworkInjectionsProvider,
  PaperworkProvider,
  PaperworkThemeProvider,
} from 'ui-components';
import {
  flattenIntakeQuestionnaireItems,
  IntakeQuestionnaireItem,
  mapQuestionnaireAndValueSetsToItemsList,
  QuestionnaireFormFields,
} from 'utils';
import { buildPreviewPages, makeStubPaperworkContext, PREVIEW_INJECTIONS } from './questionnairePreviewShared';

interface QuestionnaireTestDialogProps {
  open: boolean;
  onClose: () => void;
  questionnaire: Questionnaire;
}

// Flatten the accumulated QR-item answers (keyed page→items) into a flat linkId→value map for the
// completion summary + calculatedExpression scoring. Coded answers carry their code through.
function flattenAnswers(pageData: Record<string, QuestionnaireFormFields>): Record<string, any> {
  const flat: Record<string, any> = {};
  const walk = (items: QuestionnaireResponseItem[]): void => {
    for (const item of items) {
      const a = item.answer?.[0];
      if (a !== undefined) {
        if (a.valueCoding?.code !== undefined) flat[item.linkId] = a.valueCoding.code;
        else if (a.valueBoolean !== undefined) flat[item.linkId] = a.valueBoolean;
        else if (a.valueDecimal !== undefined) flat[item.linkId] = a.valueDecimal;
        else if (a.valueInteger !== undefined) flat[item.linkId] = a.valueInteger;
        else if (a.valueString !== undefined) flat[item.linkId] = a.valueString;
      }
      if (item.item) walk(item.item);
    }
  };
  for (const fields of Object.values(pageData)) {
    walk(Object.values(fields) as QuestionnaireResponseItem[]);
  }
  return flat;
}

/**
 * Interactive "test this form" dialog for the questionnaire builder. Renders through the shared
 * `PagedQuestionnaire` (the patient renderer) so the test matches real behavior, then shows the
 * collected answers + any computed scoring values on completion.
 */
export const QuestionnaireTestDialog: FC<QuestionnaireTestDialogProps> = ({ open, onClose, questionnaire }) => {
  const fhirItems = useMemo(() => questionnaire.item || [], [questionnaire.item]);

  const pages = useMemo<IntakeQuestionnaireItem[]>(() => {
    const converted = mapQuestionnaireAndValueSetsToItemsList(fhirItems, []);
    return buildPreviewPages(converted, questionnaire.title);
  }, [fhirItems, questionnaire.title]);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  // Per-page collected answers, so Back resumes prior answers and the summary can flatten them.
  const [pageData, setPageData] = useState<Record<string, QuestionnaireFormFields>>({});

  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex >= pages.length - 1;

  const stubContext = useMemo(() => makeStubPaperworkContext(pages, flattenIntakeQuestionnaireItems(pages)), [pages]);

  const handleSubmit = useCallback(
    (data: QuestionnaireFormFields) => {
      const pageId = currentPage?.linkId;
      if (pageId) {
        setPageData((prev) => ({ ...prev, [pageId]: data }));
      }
      if (!isLastPage) {
        setCurrentPageIndex((prev) => prev + 1);
      } else {
        setCompleted(true);
      }
    },
    [currentPage?.linkId, isLastPage]
  );

  const handleBack = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [currentPageIndex]);

  const handleClose = useCallback(() => {
    setCurrentPageIndex(0);
    setCompleted(false);
    setPageData({});
    onClose();
  }, [onClose]);

  const answers = useMemo(() => flattenAnswers(pageData), [pageData]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { minHeight: '70vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pb: 0 }}>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Page progress */}
        {pages.length > 1 && !completed && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            {pages.map((_, idx) => (
              <Box
                key={idx}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: idx <= currentPageIndex ? '#2169F5' : '#E0E0E0',
                }}
              />
            ))}
          </Box>
        )}

        {completed ? (
          <Box>
            <Typography variant="h6" sx={{ color: '#0F347C', fontWeight: 700, mb: 2 }}>
              Form Complete
            </Typography>
            {(() => {
              const computed = evaluateCalculatedExpressions(fhirItems, answers);
              const computedEntries = Object.entries(computed).filter(([, v]) => v !== undefined);
              return (
                <>
                  {computedEntries.length > 0 && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Computed scoring values (provider sees these in the QR):
                      </Typography>
                      <Box
                        sx={{
                          bgcolor: '#E2F0FF',
                          borderRadius: '8px',
                          p: 2,
                          mb: 2,
                          fontFamily: 'monospace',
                          fontSize: 12,
                          maxHeight: 250,
                          overflow: 'auto',
                        }}
                      >
                        {computedEntries.map(([k, v]) => (
                          <Box key={k} sx={{ mb: 0.5 }}>
                            <strong>{k}</strong>: {typeof v === 'string' ? `"${v}"` : String(v)}
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
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
                    {JSON.stringify(answers, null, 2)}
                  </Box>
                </>
              );
            })()}
          </Box>
        ) : currentPage ? (
          <PaperworkThemeProvider>
            <PaperworkInjectionsProvider value={PREVIEW_INJECTIONS}>
              <PaperworkProvider value={stubContext}>
                <PagedQuestionnaire
                  key={currentPage.linkId}
                  items={currentPage.item ?? []}
                  pageId={currentPage.linkId}
                  pageItem={currentPage}
                  pageSubtitle={questionnaire.description}
                  defaultValues={pageData[currentPage.linkId]}
                  onSubmit={handleSubmit}
                  saveProgress={() => {}}
                  options={{
                    controlButtons: {
                      backButton: currentPageIndex > 0,
                      onBack: currentPageIndex > 0 ? handleBack : undefined,
                      submitLabel: isLastPage ? 'Submit' : 'Continue',
                    },
                  }}
                />
              </PaperworkProvider>
            </PaperworkInjectionsProvider>
          </PaperworkThemeProvider>
        ) : (
          <Typography color="text.secondary">No items to display.</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
