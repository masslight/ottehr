import { createTheme } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { palette } from './colors';

const fontFamily = ['Rubik', 'sans-serif'].join(',');

const typography: TypographyOptions = {
  fontFamily,
  fontWeightMedium: 500,
  h1: { fontSize: 42, fontWeight: '500 !important', fontFamily, lineHeight: '140%' },
  h2: { fontSize: 36, fontWeight: '500 !important', fontFamily, lineHeight: '140%' },
  h3: { fontSize: 32, fontWeight: '600 !important', fontFamily, lineHeight: '140%' },
  h4: { fontSize: 24, fontWeight: '600 !important', fontFamily, lineHeight: '140%' },
  h5: { fontSize: 18, fontWeight: '600 !important', fontFamily, lineHeight: '140%' },
  h6: { fontSize: 16, fontWeight: '600 !important', fontFamily, lineHeight: '140%' },
  subtitle1: { fontSize: 20, fontWeight: 500, fontFamily, lineHeight: '140%' },
  subtitle2: { fontSize: 12, fontWeight: 500, fontFamily, lineHeight: '140%' },
  body1: { fontSize: 16, fontWeight: 400, fontFamily, lineHeight: '140%' },
  body2: { fontSize: 14, fontWeight: 400, fontFamily, lineHeight: '140%' },
  caption: { fontSize: 12, fontWeight: 400, fontFamily, lineHeight: '140%' },
  overline: { fontSize: 12, fontWeight: 400, fontFamily, lineHeight: '140%' },
  button: { fontSize: 14, fontWeight: 500, fontFamily, lineHeight: '140%', textTransform: 'none' },
};

export const theme = createTheme({
  palette,
  typography,
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D8DCE3' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#B6BDC9' },
        },
      },
    },
  },
});
