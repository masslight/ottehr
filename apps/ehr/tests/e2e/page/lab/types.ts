export type SelectableOption = {
  testId: string;
  display: string;
};

export type RadioSelectionResult = {
  testName: string;
  testServiceRequestId: string;
  availableValues: SelectableOption[];
  selectedValue: SelectableOption;
};
