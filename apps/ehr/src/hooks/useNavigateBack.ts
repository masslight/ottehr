import { useNavigate } from 'react-router-dom';

export const useNavigateBack = (fallbackPath: string): (() => void) => {
  const navigate = useNavigate();
  // A page opened in a new tab (e.g. from Outstanding Balance) has no in-app page to go back to.
  return () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate(fallbackPath));
};
