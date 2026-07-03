import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { buildQuestionnairePages, QuestionnaireFormPage } from 'ui-components';

interface QuestionnaireTestDialogProps {
  open: boolean;
  onClose: () => void;
  questionnaire: Questionnaire;
}

// todo re-review after you're done with intake side of things

export const QuestionnaireTestDialog: FC<QuestionnaireTestDialogProps> = ({ open, onClose, questionnaire }) => {
  const fhirItems = useMemo(() => questionnaire.item || [], [questionnaire.item]);
  const pages = useMemo(
    () => buildQuestionnairePages(fhirItems, questionnaire.title),
    [fhirItems, questionnaire.title]
  );

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const methods = useForm();

  const currentPage = pages[currentPageIndex];
  const isLastPage = currentPageIndex >= pages.length - 1;

  const handleSubmit = useCallback(
    (data: Record<string, any>) => {
      setAnswers((prev) => ({ ...prev, ...data }));
      if (!isLastPage) {
        setCurrentPageIndex((prev) => prev + 1);
      } else {
        setCompleted(true);
      }
    },
    [isLastPage]
  );

  const handleBack = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [currentPageIndex]);

  // Restore previously-entered answers when the page changes (forward or back).
  // Watched only on currentPageIndex — `answers` updates on every submit, but
  // the form state we want to restore is whatever's been accumulated so far.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    methods.reset(answersRef.current);
  }, [currentPageIndex, methods]);

  const handleClose = useCallback(() => {
    setCurrentPageIndex(0);
    setCompleted(false);
    setAnswers({});
    methods.reset();
    onClose();
  }, [methods, onClose]);

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
              return (
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
                    {JSON.stringify(answers, null, 2)}
                  </Box>
                </>
              );
            })()}
          </Box>
        ) : currentPage ? (
          <QuestionnaireFormPage
            page={currentPage}
            title={currentPage.text || questionnaire.title}
            subtitle={questionnaire.description}
            methods={methods}
            onSubmit={handleSubmit}
            onBack={currentPageIndex > 0 ? handleBack : undefined}
            isLastPage={isLastPage}
            submitLabel={isLastPage ? 'Submit' : 'Continue'}
          />
        ) : (
          <Typography color="text.secondary">No items to display.</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
