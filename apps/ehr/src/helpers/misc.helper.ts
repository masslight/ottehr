// This functionality is to ensure that sticky elements stick to the correct top when the banner is enabled
export const BANNER_HEIGHT = 60;
export const adjustTopForBannerHeight = (top: number): number => {
  return import.meta.env.VITE_APP_ENV !== 'production' ? top + BANNER_HEIGHT : top;
};

/**
 * Returns a copy of an object with empty string properties and empty object properties removed.
 */
export function cleanupProperties(object: any): any | undefined {
  const result: any = {};
  for (const propertyName in object) {
    if (Object.prototype.hasOwnProperty.call(object, propertyName)) {
      const property = object[propertyName];
      if (typeof property === 'object') {
        result[propertyName] = cleanupProperties(property);
      } else if (typeof property === 'string') {
        if (property.length > 0) {
          result[propertyName] = property;
        }
      } else if (property) {
        result[propertyName] = property;
      }
    }
  }
  if (Object.keys(result).length === 0) {
    return undefined;
  }
  return result;
}
