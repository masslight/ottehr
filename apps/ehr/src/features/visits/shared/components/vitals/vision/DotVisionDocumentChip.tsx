import { InsertDriveFileOutlined as FileIcon } from '@mui/icons-material';
import { Box, Link } from '@mui/material';
import { FC } from 'react';
import { VitalsDotVisionScreeningDocument } from 'utils';
import { useOpenDotVisionDocument } from './useOpenDotVisionDocument';

interface DotVisionDocumentChipProps {
  document: VitalsDotVisionScreeningDocument;
}

/**
 * Renders a saved DOT referral document as a clickable chip. Opening resolves a presigned download
 * URL on click (the raw Z3 URL is not directly accessible), so it works even when re-read from FHIR
 * where only the DocumentReference id is persisted.
 */
export const DotVisionDocumentChip: FC<DotVisionDocumentChipProps> = ({ document }) => {
  const { openDocument, isOpening } = useOpenDotVisionDocument();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 0.5,
        p: 0.5,
        borderRadius: 1,
        backgroundColor: '#EBEFF4',
      }}
    >
      <FileIcon fontSize="small" color="primary" />
      <Link component="button" type="button" onClick={() => void openDocument(document)} disabled={isOpening}>
        {document.title}
      </Link>
    </Box>
  );
};

export default DotVisionDocumentChip;
