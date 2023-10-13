// From https://www.matthewhoelter.com/2022/04/02/how-to-scroll-to-top-on-route-change-with-react-router-dom-v6.html
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.scrollTo({
      behavior: 'smooth',
      left: 0,
      top: 0,
    });
  }, [pathname]);

  return null;
}
