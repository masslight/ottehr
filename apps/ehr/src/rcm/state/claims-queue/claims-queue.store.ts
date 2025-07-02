import { InsurancePlan, Location, Organization } from 'fhir/r4b';
import { ClaimsQueueGetRequest, ClaimsQueueItem, EmployeeDetails } from 'utils';
import { create } from 'zustand';

type ClaimsQueueState = ClaimsQueueGetRequest & {
  selectedRows: string[];
  employees: EmployeeDetails[];
  organizations: Organization[];
  facilities: Location[];
  insurancePlans: InsurancePlan[];
  items: ClaimsQueueItem[];
};

const CLAIMS_QUEUE_INITIAL: ClaimsQueueState = {
  patient: undefined,
  visitId: undefined,
  claimId: undefined,
  teamMember: undefined,
  queue: undefined,
  dayInQueue: undefined,
  status: undefined,
  state: undefined,
  facilityGroup: undefined,
  facility: undefined,
  insurance: undefined,
  balance: undefined,
  dosFrom: undefined,
  dosTo: undefined,
  offset: 0,
  pageSize: 25,
  selectedRows: [],
  employees: [],
  organizations: [],
  facilities: [],
  insurancePlans: [],
  items: [],
};

export const useClaimsQueueStore = create<ClaimsQueueState>()(() => ({
  ...CLAIMS_QUEUE_INITIAL,
}));
