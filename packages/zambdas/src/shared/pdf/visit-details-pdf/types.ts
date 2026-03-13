import {
  Account,
  ActivityDefinition,
  Appointment,
  ChargeItem,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  InsurancePlan,
  List,
  Location,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Provenance,
  QuestionnaireResponse,
  Schedule,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import {
  ExternalLabDocuments,
  GetChartDataResponse,
  GetMedicationOrdersResponse,
  GetRadiologyOrderListZambdaOutput,
  ImmunizationOrder,
  LabDocumentRelatedToDiagnosticReport,
  Pagination,
  PatientLabItem,
  QuestionnaireData,
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
  externalLabsData?: {
    serviceRequests: ServiceRequest[];
    tasks: Task[];
    diagnosticReports: DiagnosticReport[];
    practitioners: Practitioner[];
    pagination: Pagination;
    encounters: Encounter[];
    locations: Location[];
    observations: Observation[];
    appointments: Appointment[];
    provenances: Provenance[];
    organizations: Organization[];
    questionnaires: QuestionnaireData[];
    labDocuments: ExternalLabDocuments | undefined;
    specimens: Specimen[];
    patientLabItems: PatientLabItem[];
    appointmentScheduleMap: Record<string, Schedule>;
  };
  inHouseOrdersData?: {
    serviceRequests: ServiceRequest[];
    tasks: Task[];
    practitioners: Practitioner[];
    encounters: Encounter[];
    locations: Location[];
    appointments: Appointment[];
    provenances: Provenance[];
    activityDefinitions: ActivityDefinition[];
    specimens: Specimen[];
    observations: Observation[];
    pagination: Pagination;
    diagnosticReports: DiagnosticReport[];
    resultsPDFs: LabDocumentRelatedToDiagnosticReport[];
    currentPractitioner?: Practitioner;
    appointmentScheduleMap: Record<string, Schedule>;
  };
  radiologyData?: GetRadiologyOrderListZambdaOutput;
};
