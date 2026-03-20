export type selectableOption = {
  testId: string;
  display: string;
};

export type RadioSelectionResult = {
  testName: string;
  testServiceRequestId: string;
  availableValues: selectableOption[];
  selectedValue: selectableOption;
};
