import { Box, Container } from '@mui/material';
import { FC, ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';

interface CustomContainerProps {
  children: ReactNode;
  isProvider: boolean;
  subtitle: string;
  title: string;
}
export const CustomContainer: FC<CustomContainerProps> = ({ children, isProvider, subtitle, title }) => {
  return (
    <Container
      disableGutters
      maxWidth={false}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // If there isn't enough content, this stops the footer from being in the middle of the page
        height: '100vh',
        justifyContent: 'space-between',
        minHeight: '100vh',
      }}
    >
      <Box
        alignItems="center"
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        sx={{
          height: '100%',
          m: 0,
        }}
      >
        <Header isProvider={isProvider} subtitle={subtitle} title={title} />
        <Container
          sx={{
            alignSelf: 'center',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: '1',
            maxWidth: { md: 'md', xs: 'xs' },
            px: { md: 12.5, xs: 2 },
            py: { md: 7.5, xs: 4 },
          }}
        >
          {children}
        </Container>
        <Footer />
      </Box>
    </Container>
  );
};
