export const arraysEqual = (arr1: string[], arr2: string[]): boolean => {
  const sortedArr1 = [...arr1].sort();
  const sortedArr2 = [...arr2].sort();

  if (sortedArr1 === sortedArr2) return true;
  if (sortedArr1 == null || sortedArr2 == null) return false;
  if (sortedArr1.length !== sortedArr2.length) return false;
  for (let i = 0; i < sortedArr1.length; i++) {
    if (sortedArr1[i] !== sortedArr2[i]) return false;
  }
  return true;
};
