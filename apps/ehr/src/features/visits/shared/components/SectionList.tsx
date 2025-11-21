import { Box, Divider, SxProps, Theme } from '@mui/material';
import { Fragment } from 'react';

export const SectionList = ({
  sections,
  sx,
}: {
  sections: (false | JSX.Element)[];
  sx?: SxProps<Theme>;
}): JSX.Element => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ...sx }}>
      {sections.map((section, index) => (
        <Fragment key={index}>
          {section}
          {index < sections.length - 1 && <Divider orientation="horizontal" flexItem />}
        </Fragment>
      ))}
    </Box>
  );
};
