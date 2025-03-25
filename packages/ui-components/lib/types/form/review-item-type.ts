export interface ReviewItem {
  name: string;
  path?: string;
  hidden?: boolean;
  valueString?: string;
  valueBoolean?: boolean;
  isPending?: boolean;
  valueTestId?: string;
  rowID?: string;
  testId?: string;
}
