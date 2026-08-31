import { useMediaQuery, useTheme } from '@mui/material';

export type ScreenDimensions = {
  isExtraSmallScreen: boolean;
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
  isExtraLargeScreen: boolean;
};

/**
 * MUI's screen size default breakpoints:
 *
 * xs (extra-small): 0px and up
 * sm (small): 600px and up
 * md (medium): 900px and up
 * lg (large): 1200px and up
 * xl (extra-large): 1536px and up
 */
export const useScreenDimensions = (): ScreenDimensions => {
  const theme = useTheme();
  // =====================
  // debug
  // const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // useEffect(() => {
  //   // Update the width when the window is resized
  //   const handleResize = (): void => {
  //     setWindowWidth(window.innerWidth);
  //   };

  //   window.addEventListener('resize', handleResize);

  //   // Cleanup event listener on component unmount
  //   return () => {
  //     window.removeEventListener('resize', handleResize);
  //   };
  // }, []);

  // screen size is extra large - (xl) or larger
  const isExtraLargeScreen = useMediaQuery(theme.breakpoints.up('xl'));

  // screen size size is large (lg) or larger
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  // Check if screen size is medium (md) or larger
  const isMediumScreen = useMediaQuery(theme.breakpoints.up('md'));

  // Check if screen size is small (sm) or larger
  const isSmallScreen = useMediaQuery(theme.breakpoints.up('sm'));

  // Check if screen size is extra-small (xs)
  const isExtraSmallScreen = useMediaQuery(theme.breakpoints.down('xs'));

  // useEffect(() => {
  //   console.log(
  //     `windowWidth=[${windowWidth}] :: isExtraSmall=[${isExtraSmall}] :: isSmallUp=[${isSmallUp}] :: isMediumUp=[${isMediumUp}] :: isLargeUp=[${isLargeScreen}]`
  //   );
  // }, [windowWidth, isMediumUp, isSmallUp, isExtraSmall, isLargeScreen]);

  // const userName = user?.userName;
  // useEffect(() => {
  //   console.log(`user_id = [${userId}] :: user_name=[${userName}]`);
  // }, [userId, userName]);

  // ========================

  return {
    isExtraSmallScreen,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    isExtraLargeScreen,
  };
};
