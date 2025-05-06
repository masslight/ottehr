// Types of lab tests
export type TestType = 'QUALITATIVE' | 'QUANTITATIVE' | 'URINALYSIS';

// Possible test statuses
export type TestStatus = 'ORDERED' | 'COLLECTED' | 'FINAL';

// Types of test results
export type TestResult = 'DETECTED' | 'NOT_DETECTED' | 'INDETERMINATE' | null;

// Urine analysis parameter type
export interface LabParameter {
  name: string;
  value: string | null;
  units?: string;
  referenceRange: string;
  isAbnormal?: boolean;
}

// Lab test details
export interface LabTest {
  id: string;
  type: TestType;
  name: string;
  status: TestStatus;
  result?: TestResult;
  diagnosis: string;
  specimen?: {
    source: string;
    collectedBy: string;
    collectionDate: string;
    collectionTime: string;
  };
  notes?: string;
  orderDetails?: {
    orderedBy: string;
    orderedDate: string;
    collectedBy?: string;
    collectedDate?: string;
  };
  parameters?: LabParameter[];
}
