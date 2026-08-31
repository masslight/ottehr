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
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetMedicationOrdersResponse } from 'utils/lib/types/api/medication-administration.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
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
};
