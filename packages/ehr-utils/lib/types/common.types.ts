export interface Secrets {
  [secretName: string]: string;
}

// internal communication coding
const INTERNAL_COMMUNICATION_SYSTEM = 'intra-ottehr-communication';
const ISSUE_REPORT_CODE = 'intake-issue-report';

export const COMMUNICATION_ISSUE_REPORT_CODE = {
  system: INTERNAL_COMMUNICATION_SYSTEM,
  code: ISSUE_REPORT_CODE,
};
