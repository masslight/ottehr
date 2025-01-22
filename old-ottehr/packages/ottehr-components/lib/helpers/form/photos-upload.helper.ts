// Find and return first number not in array
export const findMissingNumber = (arr: number[]): number => {
  const sortedArr = arr.sort((a, b) => a - b);

  for (let i = 0; i < sortedArr.length; i++) {
    if (sortedArr[i] !== i) {
      return i;
    }
  }

  return sortedArr.length;
};
