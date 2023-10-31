import { Box, Container, useTheme } from '@mui/material';
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
  const theme = useTheme();

  return (
    <Container
      disableGutters
      maxWidth={false}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '100vh',
      }}
    >
      <Header isProvider={isProvider} subtitle={subtitle} title={title} />
      <Box
        maxWidth="md"
        sx={{
          alignSelf: 'center',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: '1',
          px: 12.5,
          py: 7.5,
          [theme.breakpoints.down('md')]: {
            px: 2,
            py: 4,
          },
        }}
      >
        {children}
      </Box>
      <Footer />
    </Container>
  );
};
