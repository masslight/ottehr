import {
  Account,
  Appointment,
  ChargeItem,
  Coverage,
  DocumentReference,
  Encounter,
  InsurancePlan,
  List,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import {
  GetChartDataResponse,
  GetMedicationOrdersResponse,
  GetRadiologyOrderListZambdaOutput,
  ImmunizationOrder,
} from 'utils';
export interface FullAppointmentResourcePackage {
  appointment: Appointment;
  encounter: Encounter;
  mainEncounter?: Encounter;
  timezone: string;
  chargeItem?: ChargeItem;
  patient?: Patient;
  account?: Account;
  location?: Location;
  questionnaireResponse?: QuestionnaireResponse;
  practitioners?: Practitioner[];
  documentReferences?: DocumentReference[];
  listResources: List[];
  insurancePlan?: InsurancePlan;
  coverage?: Coverage;
}

export type AllChartData = {
  chartData: GetChartDataResponse;
  additionalChartData?: GetChartDataResponse;
  medicationOrders?: GetMedicationOrdersResponse['orders'];
  immunizationOrders?: ImmunizationOrder[];
  radiologyData?: GetRadiologyOrderListZambdaOutput;
};
