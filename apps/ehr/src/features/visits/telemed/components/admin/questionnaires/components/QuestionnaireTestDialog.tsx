import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { FC, useCallback, useState } from 'react';
import { QuestionnairePreview } from './QuestionnairePreview';

interface QuestionnaireTestDialogProps {
  open: boolean;
  onClose: () => void;
  questionnaire: Questionnaire;
  totalPages: number;
}

export const QuestionnaireTestDialog: FC<QuestionnaireTestDialogProps> = ({
  open,
  onClose,
  questionnaire,
  totalPages,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

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
