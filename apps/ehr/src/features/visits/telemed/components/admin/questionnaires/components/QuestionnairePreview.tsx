import { Box, Typography } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { FC, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { buildQuestionnairePages, QuestionnaireFormPage } from 'ui-components';

interface QuestionnairePreviewProps {
  // The FHIR questionnaire (managedQuestionnaireToFhir output) so the shared renderer reads the same
  // extensions (itemControl, scoring, etc.) the patient-facing form does.
  questionnaire: Questionnaire;
}

const COLORS = {
  border: '#E0E0E0',
  secondaryMain: '#2169F5',
  textSecondary: '#4F4F4F',
  pageBg: '#FFFFFF',
};

/**
 * Inline live preview of a managed questionnaire. Renders through the shared `QuestionnaireFormPage`
 * (the same component the standalone/test forms use) in read-only mode, so the preview matches the
 * real rendering instead of a bespoke approximation. Page navigation is local preview state.
 */
export const QuestionnairePreview: FC<QuestionnairePreviewProps> = ({ questionnaire }) => {
  // Top-level groups are pages (Ottehr convention); buildQuestionnairePages also skips pure
  // scoring/hidden pages and wraps a flat item list in a single synthetic page.
  const pages = useMemo(() => buildQuestionnairePages(questionnaire.item || [], questionnaire.title), [questionnaire]);

  const [currentPage, setCurrentPage] = useState(0);
  // Throwaway form instance — read-only mode never reads or submits these values.
  const methods = useForm();

  if (pages.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        Add items to see the form preview.
      </Typography>
    );
  }

  const safeCurrentPage = Math.min(currentPage, pages.length - 1);
  const page = pages[safeCurrentPage];
  const isLastPage = safeCurrentPage === pages.length - 1;

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
        {pages.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.5, width: '100%', maxWidth: 900, mb: 2 }}>
            {pages.map((_, idx) => (
              <Box
                key={idx}
                onClick={() => setCurrentPage(idx)}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: idx <= safeCurrentPage ? COLORS.secondaryMain : COLORS.border,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              />
            ))}
          </Box>
        )}

        {/* Card container — matches the patient form's Container/Card pattern */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 900,
            bgcolor: COLORS.pageBg,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: COLORS.border,
            boxShadow: '0px 1px 3px rgba(0,0,0,0.08)',
            p: { xs: 3, md: 5 },
          }}
        >
          <QuestionnaireFormPage
            page={page}
            title={page.text || questionnaire.title}
            subtitle={safeCurrentPage === 0 ? questionnaire.description : undefined}
            methods={methods}
            readOnly
            isLastPage={isLastPage}
            onBack={safeCurrentPage > 0 ? () => setCurrentPage((p) => p - 1) : undefined}
            onSubmit={() => setCurrentPage((p) => Math.min(p + 1, pages.length - 1))}
            submitLabel={isLastPage ? 'Submit' : 'Continue'}
          />

          {pages.length > 1 && (
            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'center', mt: 1, color: COLORS.textSecondary }}
            >
              Page {safeCurrentPage + 1} of {pages.length}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
