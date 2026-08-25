import { Typography } from '@mui/material';
import { createContext, FC, PropsWithChildren, useContext } from 'react';

// True while a note section container is rendered inside a card that already shows the
// section title in its header (Review & Sign). Screens that render the containers bare —
// the Follow-up Note, the telemed review tab — leave it false and keep the heading.
export const NoteSectionTitleInCardHeaderContext = createContext(false);

interface SectionHeadingProps {
  dataTestId?: string;
}

// The h5 title a note section container renders above its content, suppressed when the
// surrounding card header already shows it.
export const SectionHeading: FC<PropsWithChildren<SectionHeadingProps>> = ({ children, dataTestId }) => {
  const shownInCardHeader = useContext(NoteSectionTitleInCardHeaderContext);

  if (shownInCardHeader) return null;

  return (
    <Typography variant="h5" color="primary.dark" data-testid={dataTestId}>
      {children}
    </Typography>
  );
};
