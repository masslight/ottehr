export const nameLabTest = (testName: string | undefined, labName: string | undefined, isReflex: boolean): string => {
  if (isReflex) {
    return `${testName} (reflex)`;
  } else {
    return `${testName} / ${labName}`;
  }
};
