import { DataEntryTestItem } from 'utils';

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

type MockResults = {
  normal: string;
  abnormal: string;
};

export type MockReflexResultConfig = Record<string, MockResults>;

export type MockReflexTestConfig = {
  parent: {
    test: DataEntryTestItem;
    alert: string; // pulling this out of the AD so its easily accessible to check the UI for it later
    results: MockReflexResultConfig;
  };
  child: {
    test: DataEntryTestItem;
    results: MockReflexResultConfig;
  };
};
