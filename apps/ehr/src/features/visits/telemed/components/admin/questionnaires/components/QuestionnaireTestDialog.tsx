import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { FC, useCallback, useMemo, useState } from 'react';
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
  // counted the same way the preview lists its pages, so hidden pages are not shown as steps
  const totalPages = useMemo(() => countPreviewPages(questionnaire), [questionnaire]);

  const handleClose = useCallback(() => {
    setCurrentPageIndex(0);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { minHeight: '70vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pb: 0 }}>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
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
      </DialogContent>
    </Dialog>
  );
};
