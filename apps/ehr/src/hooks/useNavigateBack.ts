import { useLocation, useNavigate } from 'react-router-dom';

export const useNavigateBack = (fallbackPath: string): (() => void) => {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    // Auth0's login redirect replaces the history state, after which react-router stores NaN indexes.
    const hasInAppPageBehind = Number.isFinite(idx) ? Boolean(idx) : location.key !== 'default';
    if (hasInAppPageBehind) navigate(-1);
    else navigate(fallbackPath);
  };
};
