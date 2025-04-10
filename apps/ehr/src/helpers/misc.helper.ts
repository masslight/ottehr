// This functionality is to ensure that sticky elements stick to the correct top when the banner is enabled
export const BANNER_HEIGHT = 60;
export const adjustTopForBannerHeight = (top: number): number => {
  return import.meta.env.VITE_APP_ENV !== 'production' ? top + BANNER_HEIGHT : top;
};
