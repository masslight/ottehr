import { Box } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { FC, useCallback, useMemo, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { countPreviewPages } from '../questionnaire-utils';
import { QuestionnairePreview } from './QuestionnairePreview';

interface QuestionnaireTestDialogProps {
  open: boolean;
  onClose: () => void;
  questionnaire: Questionnaire;
}

export const QuestionnaireTestDialog: FC<QuestionnaireTestDialogProps> = ({ open, onClose, questionnaire }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const totalPages = useMemo(() => countPreviewPages(questionnaire), [questionnaire]);

  const handleClose = useCallback(() => {
    setCurrentPageIndex(0);
    onClose();
  }, [onClose]);

  return (
    <AppDialog variant="form" size="m" open={open} onClose={handleClose} title="Test Form">
      {/* Keeps the dialog at least 70vh tall, as before, so it does not jump between pages. */}
      <Box sx={{ minHeight: 'calc(70vh - 92px)' }}>
        {/* Page progress */}
        {totalPages > 1 && !completed && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            {Array.from({ length: totalPages }, (_, idx) => (
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

        <QuestionnairePreview
          questionnaire={questionnaire}
          currentPageIndex={currentPageIndex}
          setCurrentPageIndex={setCurrentPageIndex}
          completed={completed}
          setCompleted={setCompleted}
          previewMode={'full'}
        />
      </Box>
    </AppDialog>
  );
};
