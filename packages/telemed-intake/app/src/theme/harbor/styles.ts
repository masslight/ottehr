import { otherColors } from './colors';

export default {
  MuiAppBar: {
    styleOverrides: {
      root: {
        display: 'none',
        backgroundColor: otherColors.appbarBackground,
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 50,
        '& .CustomerSupportFeature': {
          display: 'none',
        },
      },
    },
  },
  MuiContainer: {
    styleOverrides: {
      root: {
        '& .CustomerSupportFeature': {
          display: 'none',
        },
      },
    },
  },
  MuiRadio: {
    styleOverrides: {
      root: {
        color: otherColors.lightBlue,
      },
    },
  },
};
