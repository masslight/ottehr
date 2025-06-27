import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { breakpoints } from '../../providers';

export const useIsMobile = (): boolean => {
  const isMobileMediaQuery = useMediaQuery(`(max-width: ${breakpoints.values?.sm}px)`);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleDeviceDetection = (): void => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUserAgent = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
      const isTabletUserAgent = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/g.test(userAgent);
      setIsMobile(isMobileUserAgent || isTabletUserAgent);
    };

    handleDeviceDetection();
    window.addEventListener('resize', handleDeviceDetection);

    return () => window.removeEventListener('resize', handleDeviceDetection);
  }, []);

  return isMobileMediaQuery || isMobile;
};
