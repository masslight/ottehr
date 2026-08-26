import { Typography } from '@mui/material';
import { createContext, FC, PropsWithChildren, useContext } from 'react';

const NoteSectionTitleInCardHeaderContext = createContext(false);

export const NoteSectionTitleInCardHeaderProvider = NoteSectionTitleInCardHeaderContext.Provider;

/**
 * True when the surrounding card header already shows the section title, so the container
 * should not repeat it. False on the screens that render the containers bare — the
 * Follow-up Note, the telemed review tab.
 */
export const useNoteSectionTitleInCardHeader = (): boolean => useContext(NoteSectionTitleInCardHeaderContext);

interface SectionHeadingProps {
  dataTestId?: string;
}

/** The h5 title a note section container renders above its content. */
export const SectionHeading: FC<PropsWithChildren<SectionHeadingProps>> = ({ children, dataTestId }) => (
  <Typography variant="h5" color="primary.dark" data-testid={dataTestId}>
    {children}
  </Typography>
);
