// compensates for the zap sdk currently not uri encoding query params on batch request urls. hopefully
// a future improvement obviates the need for doing this encoding.
export const encodePlusSign = (url: string): string => {
  if (url.includes('+')) {
    return encodePlusSign(url.replace('+', '%2B'));
  }
  return url;
};
