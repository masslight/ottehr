import { useLocation } from 'react-router-dom';

export const usePageIntakeStatus = (): { filledPages: string[]; currentPage: string } => {
  const location = useLocation();

  // TODO now mock data for filled pages (replace with actual state management later)
  const filledPages = [] as string[];

  const getCurrentPage = (path: string): string => {
    const segments = path.split('/');
    return segments[segments.length - 1];
  };

  const currentPage = getCurrentPage(location.pathname);

  return { filledPages, currentPage };
};
