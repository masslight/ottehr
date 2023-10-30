// TODO add provider type
export const needsDot = (provider: any): boolean => {
  return ['Dr', 'Mr', 'Mrs', 'Ms'].includes(provider.title);
};
