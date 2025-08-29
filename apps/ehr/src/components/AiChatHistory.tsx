import { Typography } from '@mui/material';
import { DocumentReference } from 'fhir/r4b';
import { FC } from 'react';
import { getContentOfDocumentReference } from 'src/helpers/documentReferences';

export interface AiChatHistoryProps {
  documentReference: DocumentReference;
}

export const AiChatHistory: FC<AiChatHistoryProps> = ({ documentReference }) => {
  const contentTranscript = getContentOfDocumentReference(documentReference, 'Transcript');
  return (
    <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
      {contentTranscript || 'No transcript available'}
    </Typography>
  );
};
