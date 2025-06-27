import { MedicationAdministration, MedicationStatement, Patient, Practitioner } from 'fhir/r4b';
import { z } from 'zod';
import { MEDICATION_APPLIANCE_LOCATION_SYSTEM } from './medication-administration.constants';

export enum MedicationOrderStatuses {
  'pending' = 'pending',
  'administered-partly' = 'administered-partly',
  'administered-not' = 'administered-not',
  'administered' = 'administered',
  'cancelled' = 'cancelled',
}
export type MedicationOrderStatusesType = `${MedicationOrderStatuses}`;

export const GetMedicationOrdersInputSchema = z.object({
  searchBy: z.union([
    z.object({
      field: z.literal('encounterId'),
      value: z.string(),
    }),
    z.object({
      field: z.literal('encounterIds'),
      value: z.array(z.string()),
    }),
  ]),
});
export type GetMedicationOrdersInput = z.infer<typeof GetMedicationOrdersInputSchema>;
export interface GetMedicationOrdersResponse {
  orders: ExtendedMedicationDataForResponse[];
}

export interface UpdateMedicationOrderInput {
  orderId?: string;
  newStatus?: MedicationOrderStatusesType;
  orderData?: MedicationData;
}

export interface MedicationData {
  patient: string;
  encounterId: string;
  medicationId?: string;
  dose: number;
  route: string;
  instructions?: string;
  reason?: string;
  otherReason?: string;
  associatedDx?: string;
  units?: string;
  manufacturer?: string;
  location?: string;

  // scanning part
  lotNumber?: string;
  expDate?: string;

  // administrating
  dateGiven?: string;
  timeGiven?: string;
}

export interface ExtendedMedicationDataForResponse extends MedicationData {
  id: string;
  status: MedicationOrderStatusesType;
  medicationName: string;
  providerCreatedTheOrder: string;
  providerCreatedTheOrderId: string;
  dateTimeCreated: string;
  administeredProvider?: string;
  administeredProviderId?: string;
  // todo i wanna change all long names to this short form
  // creationData: {
  //   dateTime: string;
  //   providerId: string;
  //   providerName: string;
  // };
  // administeredData?: {
  //   dateGiven: string;
  //   timeGiven: string;
  //   providerId: string;
  //   providerName: string;
  // };
}

export interface OrderPackage {
  medicationAdministration: MedicationAdministration;
  patient: Patient;
  medicationStatement?: MedicationStatement;
  providerCreatedOrder?: Practitioner;
  providerAdministeredOrder?: Practitioner;
}

export interface MedicationApplianceLocation {
  name?: string;
  code: string;
  system?: string;
  display?: string;
}

export interface MedicationApplianceRoute {
  code: string;
  system?: string;
  display?: string;
}

export type MedicationApplianceRoutes = {
  [key: string]: MedicationApplianceRoute;
};

export const medicationApplianceLocations: MedicationApplianceLocation[] = [
  {
    name: 'Ear, Left',
    code: '89644007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Left ear structure (body structure)',
  },
  {
    name: 'Ear, Right',
    code: '25577004',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Right ear structure (body structure)',
  },
  {
    name: 'Ears, Bilateral',
    code: '34338003',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Both ears (body structure)',
  },
  {
    name: 'Eye, Left',
    code: '726675003',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of left eye region (body structure)',
  },
  {
    name: 'Eye, Right',
    code: '726680007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of right eye region (body structure)',
  },
  {
    name: 'Eyes, Bilateral',
    code: '40638003',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of both eyes (body structure)',
  },
  {
    name: 'Left Antecubital Fossa',
    code: '128553008',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of antecubital vein (body structure)',
  },
  {
    name: 'Left Deltoid',
    code: '16217701000119102',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of left deltoid muscle (body structure)',
  },
  {
    name: 'Left Foot',
    code: '22335008',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of left foot (body structure)',
  },
  {
    name: 'Left Gluteus Maximus',
    code: '206007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of gluteus maximus muscle (body structure)',
  },
  {
    name: 'Left Hand',
    code: '85151006',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of left hand (body structure)',
  },
  {
    name: 'Right Antecubital Fossa',
    code: '128553008',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of antecubital vein (body structure)',
  },
  {
    name: 'Right Deltoid',
    code: '16217661000119109',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of right deltoid muscle (body structure)',
  },
  {
    name: 'Right Foot',
    code: '7769000',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of right foot (body structure)',
  },
  {
    name: 'Right Gluteus Maximus',
    code: '206007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of gluteus maximus muscle (body structure)',
  },
  {
    name: 'Right Hand',
    code: '78791008',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of right hand (body structure)',
  },
  {
    name: 'Other',
    code: '74964007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Other (qualifier value)',
  },
  {
    name: 'Volume divided, R and L vastus lateralis',
    code: '1217007000',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of left vastus lateralis muscle (body structure)',
  },
  {
    name: 'Volume divided, R and L vastus lateralis',
    code: '1217006009',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of right vastus lateralis muscle (body structure)',
  },
  {
    name: 'Volume divided, R and L deltoid',
    code: '16217661000119109',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of right deltoid muscle (body structure)',
  },
  {
    name: 'Volume divided, R and L deltoid',
    code: '16217701000119102',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Structure of left deltoid muscle (body structure)',
  },
  {
    name: 'liters via nebulizer',
    code: '334947002',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Nebulizer (physical object)',
  },
  {
    name: 'liters via nasal cannula',
    code: '336623009',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Oxygen nasal cannula (physical object)',
  },
  {
    name: 'liters via bag-valve-mask',
    code: '425696007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Manual respiratory assistance using bag and mask (procedure)',
  },
  {
    name: 'liters via non-rebreather',
    code: '427591007',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Nonrebreather oxygen mask (physical object)',
  },
  {
    name: 'liters via facemask',
    code: '261352009',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Face mask (physical object)',
  },
  {
    name: 'given as inhaler',
    code: '334980009',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Inhaler (physical object)',
  },
  {
    name: 'given as inhaler with spacer',
    code: '464036000',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Medicine chamber spacer (physical object)',
  },
  {
    name: 'given per rectum',
    code: '34402009',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Rectum structure (body structure)',
  },
  {
    name: 'given via nebulizer',
    code: '334947002',
    system: MEDICATION_APPLIANCE_LOCATION_SYSTEM,
    display: 'Nebulizer (physical object)',
  },
];

export const medicationApplianceRoutes: MedicationApplianceRoutes = {
  ROUTE_OF_ADMINISTRATION: {
    code: '284009009',
    system: 'http://snomed.info/sct',
    display: 'Route of administration values',
  },
  TOPICAL: {
    code: '6064005',
    system: 'http://snomed.info/sct',
    display: 'Topical route',
  },
  OTIC: {
    code: '10547007',
    system: 'http://snomed.info/sct',
    display: 'Otic route',
  },
  INTRA_ARTICULAR: {
    code: '12130007',
    system: 'http://snomed.info/sct',
    display: 'Intra-articular route',
  },
  VAGINAL: {
    code: '16857009',
    system: 'http://snomed.info/sct',
    display: 'Per vagina',
  },
  ORAL: {
    code: '26643006',
    system: 'http://snomed.info/sct',
    display: 'Oral route',
  },
  SUBCUTANEOUS: {
    code: '34206005',
    system: 'http://snomed.info/sct',
    display: 'Subcutaneous route',
  },
  RECTAL: {
    code: '37161004',
    system: 'http://snomed.info/sct',
    display: 'Per rectum',
  },
  INTRALUMINAL: {
    code: '37737002',
    system: 'http://snomed.info/sct',
    display: 'Intraluminal route',
  },
  SUBLINGUAL: {
    code: '37839007',
    system: 'http://snomed.info/sct',
    display: 'Sublingual route',
  },
  INTRAPERITONEAL: {
    code: '38239002',
    system: 'http://snomed.info/sct',
    display: 'Intraperitoneal route',
  },
  TRANSDERMAL: {
    code: '45890007',
    system: 'http://snomed.info/sct',
    display: 'Transdermal route',
  },
  NASAL: {
    code: '46713006',
    system: 'http://snomed.info/sct',
    display: 'Nasal route',
  },
  INTRAVENOUS: {
    code: '47625008',
    system: 'http://snomed.info/sct',
    display: 'Intravenous route',
  },
  BUCCAL: {
    code: '54471007',
    system: 'http://snomed.info/sct',
    display: 'Buccal route',
  },
  OPHTHALMIC: {
    code: '54485002',
    system: 'http://snomed.info/sct',
    display: 'Ophthalmic route',
  },
  INTRA_ARTERIAL: {
    code: '58100008',
    system: 'http://snomed.info/sct',
    display: 'Intra-arterial route',
  },
  INTRAMEDULLARY: {
    code: '60213007',
    system: 'http://snomed.info/sct',
    display: 'Intramedullary route',
  },
  INTRAUTERINE: {
    code: '62226000',
    system: 'http://snomed.info/sct',
    display: 'Intrauterine route',
  },
  INTRATHECAL: {
    code: '72607000',
    system: 'http://snomed.info/sct',
    display: 'Intrathecal route',
  },
  INTRAMUSCULAR: {
    code: '78421000',
    system: 'http://snomed.info/sct',
    display: 'Intramuscular route',
  },
  URETHRAL: {
    code: '90028008',
    system: 'http://snomed.info/sct',
    display: 'Urethral route',
  },
  GASTROSTOMY: {
    code: '127490009',
    system: 'http://snomed.info/sct',
    display: 'Gastrostomy route',
  },
  JEJUNOSTOMY: {
    code: '127491008',
    system: 'http://snomed.info/sct',
    display: 'Jejunostomy route',
  },
  NASOGASTRIC: {
    code: '127492001',
    system: 'http://snomed.info/sct',
    display: 'Nasogastric route',
  },
  DENTAL: {
    code: '372449004',
    system: 'http://snomed.info/sct',
    display: 'Dental use',
  },
  ENDOCERVICAL: {
    code: '372450004',
    system: 'http://snomed.info/sct',
    display: 'Endocervical use',
  },
  ENDOSINUSIAL: {
    code: '372451000',
    system: 'http://snomed.info/sct',
    display: 'Endosinusial use',
  },
  ENDOTRACHEOPULMONARY: {
    code: '372452007',
    system: 'http://snomed.info/sct',
    display: 'Endotracheopulmonary use',
  },
  EXTRA_AMNIOTIC: {
    code: '372453002',
    system: 'http://snomed.info/sct',
    display: 'Extra-amniotic use',
  },
  GASTROENTERAL: {
    code: '372454008',
    system: 'http://snomed.info/sct',
    display: 'Gastroenteral use',
  },
  GINGIVAL: {
    code: '372457001',
    system: 'http://snomed.info/sct',
    display: 'Gingival use',
  },
  INTRAAMNIOTIC: {
    code: '372458006',
    system: 'http://snomed.info/sct',
    display: 'Intraamniotic use',
  },
  INTRABURSAL: {
    code: '372459003',
    system: 'http://snomed.info/sct',
    display: 'Intrabursal use',
  },
  INTRACARDIAC: {
    code: '372460008',
    system: 'http://snomed.info/sct',
    display: 'Intracardiac use',
  },
  INTRACAVERNOUS: {
    code: '372461007',
    system: 'http://snomed.info/sct',
    display: 'Intracavernous use',
  },
  INTRACERVICAL: {
    code: '372462000',
    system: 'http://snomed.info/sct',
    display: 'Intracervical route (qualifier value)',
  },
  INTRACORONARY: {
    code: '372463005',
    system: 'http://snomed.info/sct',
    display: 'Intracoronary use',
  },
  INTRADERMAL: {
    code: '372464004',
    system: 'http://snomed.info/sct',
    display: 'Intradermal use',
  },
  INTRADISCAL: {
    code: '372465003',
    system: 'http://snomed.info/sct',
    display: 'Intradiscal use',
  },
  INTRALESIONAL: {
    code: '372466002',
    system: 'http://snomed.info/sct',
    display: 'Intralesional use',
  },
  INTRALYMPHATIC: {
    code: '372467006',
    system: 'http://snomed.info/sct',
    display: 'Intralymphatic use',
  },
  INTRAOCULAR: {
    code: '372468001',
    system: 'http://snomed.info/sct',
    display: 'Intraocular use',
  },
  INTRAPLEURAL: {
    code: '372469009',
    system: 'http://snomed.info/sct',
    display: 'Intrapleural use',
  },
  INTRASTERNAL: {
    code: '372470005',
    system: 'http://snomed.info/sct',
    display: 'Intrasternal use',
  },
  INTRAVESICAL: {
    code: '372471009',
    system: 'http://snomed.info/sct',
    display: 'Intravesical use',
  },
  OCULAR: {
    code: '372472002',
    system: 'http://snomed.info/sct',
    display: 'Ocular route (qualifier value)',
  },
  OROMUCOSAL: {
    code: '372473007',
    system: 'http://snomed.info/sct',
    display: 'Oromucosal use',
  },
  PERIARTICULAR: {
    code: '372474001',
    system: 'http://snomed.info/sct',
    display: 'Periarticular use',
  },
  PERINEURAL: {
    code: '372475000',
    system: 'http://snomed.info/sct',
    display: 'Perineural use',
  },
  SUBCONJUNCTIVAL: {
    code: '372476004',
    system: 'http://snomed.info/sct',
    display: 'Subconjunctival use',
  },
  TRANSMUCOSAL: {
    code: '404815008',
    system: 'http://snomed.info/sct',
    display: 'Transmucosal route (qualifier value)',
  },
  INTRATRACHEAL: {
    code: '404818005',
    system: 'http://snomed.info/sct',
    display: 'Intratracheal route (qualifier value)',
  },
  INTRABILIARY: {
    code: '404819002',
    system: 'http://snomed.info/sct',
    display: 'Intrabiliary route (qualifier value)',
  },
  EPIDURAL: {
    code: '404820008',
    system: 'http://snomed.info/sct',
    display: 'Epidural route (qualifier value)',
  },
  SUBORBITAL: {
    code: '416174007',
    system: 'http://snomed.info/sct',
    display: 'Suborbital route (qualifier value)',
  },
  CAUDAL: {
    code: '417070009',
    system: 'http://snomed.info/sct',
    display: 'Caudal route (qualifier value)',
  },
  INTRAOSSEOUS: {
    code: '417255000',
    system: 'http://snomed.info/sct',
    display: 'Intraosseous route (qualifier value)',
  },
  INTRATHORACIC: {
    code: '417950001',
    system: 'http://snomed.info/sct',
    display: 'Intrathoracic route (qualifier value)',
  },
  ENTERAL: {
    code: '417985001',
    system: 'http://snomed.info/sct',
    display: 'Enteral route (qualifier value)',
  },
  INTRADUCTAL: {
    code: '417989007',
    system: 'http://snomed.info/sct',
    display: 'Intraductal route (qualifier value)',
  },
  INTRATYMPANIC: {
    code: '418091004',
    system: 'http://snomed.info/sct',
    display: 'Intratympanic route (qualifier value)',
  },
  INTRAVENOUS_CENTRAL: {
    code: '418114005',
    system: 'http://snomed.info/sct',
    display: 'Intravenous central route (qualifier value)',
  },
  INTRAMYOMETRIAL: {
    code: '418133000',
    system: 'http://snomed.info/sct',
    display: 'Intramyometrial route (qualifier value)',
  },
  GASTRO_INTESTINAL_STOMA: {
    code: '418136008',
    system: 'http://snomed.info/sct',
    display: 'Gastro-intestinal stoma route (qualifier value)',
  },
  COLOSTOMY: {
    code: '418162004',
    system: 'http://snomed.info/sct',
    display: 'Colostomy route (qualifier value)',
  },
  PERIURETHRAL: {
    code: '418204005',
    system: 'http://snomed.info/sct',
    display: 'Periurethral route (qualifier value)',
  },
  INTRACORONAL: {
    code: '418287000',
    system: 'http://snomed.info/sct',
    display: 'Intracoronal route (qualifier value)',
  },
  RETROBULBAR: {
    code: '418321004',
    system: 'http://snomed.info/sct',
    display: 'Retrobulbar route (qualifier value)',
  },
  INTRACARTILAGINOUS: {
    code: '418331006',
    system: 'http://snomed.info/sct',
    display: 'Intracartilaginous route (qualifier value)',
  },
  INTRAVITREAL: {
    code: '418401004',
    system: 'http://snomed.info/sct',
    display: 'Intravitreal route (qualifier value)',
  },
  INTRASPINAL: {
    code: '418418000',
    system: 'http://snomed.info/sct',
    display: 'Intraspinal route (qualifier value)',
  },
  OROGASTRIC: {
    code: '418441008',
    system: 'http://snomed.info/sct',
    display: 'Orogastric route (qualifier value)',
  },
  TRANSURETHRAL: {
    code: '418511008',
    system: 'http://snomed.info/sct',
    display: 'Transurethral route (qualifier value)',
  },
  INTRATENDINOUS: {
    code: '418586008',
    system: 'http://snomed.info/sct',
    display: 'Intratendinous route (qualifier value)',
  },
  INTRACORNEAL: {
    code: '418608002',
    system: 'http://snomed.info/sct',
    display: 'Intracorneal route (qualifier value)',
  },
  OROPHARYNGEAL: {
    code: '418664002',
    system: 'http://snomed.info/sct',
    display: 'Oropharyngeal route (qualifier value)',
  },
  PERIBULBAR: {
    code: '418722009',
    system: 'http://snomed.info/sct',
    display: 'Peribulbar route (qualifier value)',
  },
  NASOJEJUNAL: {
    code: '418730005',
    system: 'http://snomed.info/sct',
    display: 'Nasojejunal route (qualifier value)',
  },
  FISTULA: {
    code: '418743005',
    system: 'http://snomed.info/sct',
    display: 'Fistula route (qualifier value)',
  },
  SURGICAL_DRAIN: {
    code: '418813001',
    system: 'http://snomed.info/sct',
    display: 'Surgical drain route (qualifier value)',
  },
  INTRACAMERAL: {
    code: '418821007',
    system: 'http://snomed.info/sct',
    display: 'Intracameral route (qualifier value)',
  },
  PARACERVICAL: {
    code: '418851001',
    system: 'http://snomed.info/sct',
    display: 'Paracervical route (qualifier value)',
  },
  INTRASYNOVIAL: {
    code: '418877009',
    system: 'http://snomed.info/sct',
    display: 'Intrasynovial route (qualifier value)',
  },
  INTRADUODENAL: {
    code: '418887008',
    system: 'http://snomed.info/sct',
    display: 'Intraduodenal route (qualifier value)',
  },
  INTRACISTERNAL: {
    code: '418892005',
    system: 'http://snomed.info/sct',
    display: 'Intracisternal route (qualifier value)',
  },
  INTRATESTICULAR: {
    code: '418947002',
    system: 'http://snomed.info/sct',
    display: 'Intratesticular route (qualifier value)',
  },
  INTRACRANIAL: {
    code: '418987007',
    system: 'http://snomed.info/sct',
    display: 'Intracranial route (qualifier value)',
  },
  TUMOR_CAVITY: {
    code: '419021003',
    system: 'http://snomed.info/sct',
    display: 'Tumor cavity route',
  },
  PARAVERTEBRAL: {
    code: '419165009',
    system: 'http://snomed.info/sct',
    display: 'Paravertebral route (qualifier value)',
  },
  INTRASINAL: {
    code: '419231003',
    system: 'http://snomed.info/sct',
    display: 'Intrasinal route (qualifier value)',
  },
  TRANSCERVICAL: {
    code: '419243002',
    system: 'http://snomed.info/sct',
    display: 'Transcervical route (qualifier value)',
  },
  SUBTENDINOUS: {
    code: '419320008',
    system: 'http://snomed.info/sct',
    display: 'Subtendinous route (qualifier value)',
  },
  INTRAABDOMINAL: {
    code: '419396008',
    system: 'http://snomed.info/sct',
    display: 'Intraabdominal route (qualifier value)',
  },
  SUBGINGIVAL: {
    code: '419601003',
    system: 'http://snomed.info/sct',
    display: 'Subgingival route (qualifier value)',
  },
  INTRAOVARIAN: {
    code: '419631009',
    system: 'http://snomed.info/sct',
    display: 'Intraovarian route (qualifier value)',
  },
  URETERAL: {
    code: '419684008',
    system: 'http://snomed.info/sct',
    display: 'Ureteral route (qualifier value)',
  },
  PERITENDINOUS: {
    code: '419762003',
    system: 'http://snomed.info/sct',
    display: 'Peritendinous route (qualifier value)',
  },
  INTRABRONCHIAL: {
    code: '419778001',
    system: 'http://snomed.info/sct',
    display: 'Intrabronchial route (qualifier value)',
  },
  INTRAPROSTATIC: {
    code: '419810008',
    system: 'http://snomed.info/sct',
    display: 'Intraprostatic route (qualifier value)',
  },
  SUBMUCOSAL: {
    code: '419874009',
    system: 'http://snomed.info/sct',
    display: 'Submucosal route (qualifier value)',
  },
  SURGICAL_CAVITY: {
    code: '419894000',
    system: 'http://snomed.info/sct',
    display: 'Surgical cavity route (qualifier value)',
  },
  ILEOSTOMY: {
    code: '419954003',
    system: 'http://snomed.info/sct',
    display: 'Ileostomy route (qualifier value)',
  },
  INTRAVENOUS_PERIPHERAL: {
    code: '419993007',
    system: 'http://snomed.info/sct',
    display: 'Intravenous peripheral route (qualifier value)',
  },
  PERIOSTEAL: {
    code: '420047004',
    system: 'http://snomed.info/sct',
    display: 'Periosteal route (qualifier value)',
  },
  ESOPHAGOSTOMY: {
    code: '420163009',
    system: 'http://snomed.info/sct',
    display: 'Esophagostomy route',
  },
  UROSTOMY: {
    code: '420168000',
    system: 'http://snomed.info/sct',
    display: 'Urostomy route (qualifier value)',
  },
  LARYNGEAL: {
    code: '420185003',
    system: 'http://snomed.info/sct',
    display: 'Laryngeal route (qualifier value)',
  },
  INTRAPULMONARY: {
    code: '420201002',
    system: 'http://snomed.info/sct',
    display: 'Intrapulmonary route (qualifier value)',
  },
  MUCOUS_FISTULA: {
    code: '420204005',
    system: 'http://snomed.info/sct',
    display: 'Mucous fistula route (qualifier value)',
  },
  NASODUODENAL: {
    code: '420218003',
    system: 'http://snomed.info/sct',
    display: 'Nasoduodenal route (qualifier value)',
  },
  BODY_CAVITY: {
    code: '420254004',
    system: 'http://snomed.info/sct',
    display: 'Body cavity route (qualifier value)',
  },
  INTRAVENTRICULAR_CARDIAC: {
    code: '420287000',
    system: 'http://snomed.info/sct',
    display: 'Intraventricular route - cardiac (qualifier value)',
  },
  INTRACEREBROVENTRICULAR: {
    code: '420719007',
    system: 'http://snomed.info/sct',
    display: 'Intracerebroventricular route (qualifier value)',
  },
  PERCUTANEOUS: {
    code: '428191002',
    system: 'http://snomed.info/sct',
    display: 'Percutaneous route (qualifier value)',
  },
  INTERSTITIAL: {
    code: '429817007',
    system: 'http://snomed.info/sct',
    display: 'Interstitial route (qualifier value)',
  },
  INTRAESOPHAGEAL: {
    code: '445752009',
    system: 'http://snomed.info/sct',
    display: 'Intraesophageal route (qualifier value)',
  },
  INTRAGINGIVAL: {
    code: '445754005',
    system: 'http://snomed.info/sct',
    display: 'Intragingival route (qualifier value)',
  },
  INTRAVASCULAR: {
    code: '445755006',
    system: 'http://snomed.info/sct',
    display: 'Intravascular route (qualifier value)',
  },
  INTRADURAL: {
    code: '445756007',
    system: 'http://snomed.info/sct',
    display: 'Intradural route (qualifier value)',
  },
  INTRAMENINGEAL: {
    code: '445767008',
    system: 'http://snomed.info/sct',
    display: 'Intrameningeal route (qualifier value)',
  },
  INTRAGASTRIC: {
    code: '445768003',
    system: 'http://snomed.info/sct',
    display: 'Intragastric route (qualifier value)',
  },
  INTRACORPORUS_CAVERNOSUM: {
    code: '445769006',
    system: 'http://snomed.info/sct',
    display: 'Intracorporus cavernosum of penis route',
  },
  INTRAPERICARDIAL: {
    code: '445771006',
    system: 'http://snomed.info/sct',
    display: 'Intrapericardial route (qualifier value)',
  },
  INTRALINGUAL: {
    code: '445913005',
    system: 'http://snomed.info/sct',
    display: 'Intralingual route (qualifier value)',
  },
  INTRAHEPATIC: {
    code: '445941009',
    system: 'http://snomed.info/sct',
    display: 'Intrahepatic route (qualifier value)',
  },
  CONJUNCTIVAL: {
    code: '446105004',
    system: 'http://snomed.info/sct',
    display: 'Conjunctival route (qualifier value)',
  },
  INTRAEPICARDIAL: {
    code: '446407004',
    system: 'http://snomed.info/sct',
    display: 'Intraepicardial route (qualifier value)',
  },
  TRANSENDOCARDIAL: {
    code: '446435000',
    system: 'http://snomed.info/sct',
    display: 'Transendocardial route (qualifier value)',
  },
  TRANSPLACENTAL: {
    code: '446442000',
    system: 'http://snomed.info/sct',
    display: 'Transplacental route (qualifier value)',
  },
  INTRACEREBRAL: {
    code: '446540005',
    system: 'http://snomed.info/sct',
    display: 'Intracerebral route (qualifier value)',
  },
  INTRAILEAL: {
    code: '447026006',
    system: 'http://snomed.info/sct',
    display: 'Intraileal route (qualifier value)',
  },
  PERIODONTAL: {
    code: '447052000',
    system: 'http://snomed.info/sct',
    display: 'Periodontal route (qualifier value)',
  },
  PERIDURAL: {
    code: '447080003',
    system: 'http://snomed.info/sct',
    display: 'Peridural route (qualifier value)',
  },
  LOWER_RESPIRATORY_TRACT: {
    code: '447081004',
    system: 'http://snomed.info/sct',
    display: 'Lower respiratory tract route (qualifier value)',
  },
  INTRAMAMMARY: {
    code: '447121004',
    system: 'http://snomed.info/sct',
    display: 'Intramammary route (qualifier value)',
  },
  INTRATUMOR: {
    code: '447122006',
    system: 'http://snomed.info/sct',
    display: 'Intratumor route (qualifier value)',
  },
  TRANSTYMPANIC: {
    code: '447227007',
    system: 'http://snomed.info/sct',
    display: 'Transtympanic route (qualifier value)',
  },
  TRANSTRACHEAL: {
    code: '447229005',
    system: 'http://snomed.info/sct',
    display: 'Transtracheal route (qualifier value)',
  },
  RESPIRATORY_TRACT: {
    code: '447694001',
    system: 'http://snomed.info/sct',
    display: 'Respiratory tract route (qualifier value)',
  },
  DIGESTIVE_TRACT: {
    code: '447964005',
    system: 'http://snomed.info/sct',
    display: 'Digestive tract route (qualifier value)',
  },
  INTRAEPIDERMAL: {
    code: '448077001',
    system: 'http://snomed.info/sct',
    display: 'Intraepidermal route (qualifier value)',
  },
  INTRAJEJUNAL: {
    code: '448491004',
    system: 'http://snomed.info/sct',
    display: 'Intrajejunal route (qualifier value)',
  },
  INTRACOLONIC: {
    code: '448492006',
    system: 'http://snomed.info/sct',
    display: 'Intracolonic route (qualifier value)',
  },
  CUTANEOUS: {
    code: '448598008',
    system: 'http://snomed.info/sct',
    display: 'Cutaneous route (qualifier value)',
  },
  ARTERIOVENOUS_FISTULA: {
    code: '697971008',
    system: 'http://snomed.info/sct',
    display: 'Arteriovenous fistula route (qualifier value)',
  },
  INTRANEURAL: {
    code: '711360002',
    system: 'http://snomed.info/sct',
    display: 'Intraneural route (qualifier value)',
  },
  INTRAMURAL: {
    code: '711378007',
    system: 'http://snomed.info/sct',
    display: 'Intramural route (qualifier value)',
  },
  EXTRACORPOREAL: {
    code: '714743009',
    system: 'http://snomed.info/sct',
    display: 'Extracorporeal route (qualifier value)',
  },
  INFILTRATION: {
    code: '718329006',
    system: 'http://snomed.info/sct',
    display: 'Infiltration route (qualifier value)',
  },
  EPILESIONAL: {
    code: '764723001',
    system: 'http://snomed.info/sct',
    display: 'Epilesional route (qualifier value)',
  },
  EXTRACORPOREAL_HEMODIALYSIS: {
    code: '766790006',
    system: 'http://snomed.info/sct',
    display: 'Extracorporeal hemodialysis route (qualifier value)',
  },
  INTRADIALYTIC: {
    code: '876824003',
    system: 'http://snomed.info/sct',
    display: 'Intradialytic route',
  },
  INTRACATHETER: {
    code: '1078280005',
    system: 'http://snomed.info/sct',
    display: 'Intracatheter instillation route (qualifier value)',
  },
  SUBLESIONAL: {
    code: '1611000175109',
    system: 'http://snomed.info/sct',
    display: 'Sublesional route (qualifier value)',
  },
  INTESTINAL: {
    code: '58731000052100',
    system: 'http://snomed.info/sct',
    display: 'Intestinal route (qualifier value)',
  },
  INTRAGLANDULAR: {
    code: '58751000052109',
    system: 'http://snomed.info/sct',
    display: 'Intraglandular route (qualifier value)',
  },
  INTRACHOLANGIOPANCREATIC: {
    code: '58761000052107',
    system: 'http://snomed.info/sct',
    display: 'Intracholangiopancreatic route',
  },
  INTRAPORTAL: {
    code: '58771000052103',
    system: 'http://snomed.info/sct',
    display: 'Intraportal route',
  },
  PERITUMORAL: {
    code: '58811000052103',
    system: 'http://snomed.info/sct',
    display: 'Peritumoral route (qualifier value)',
  },
  POSTERIOR_JUXTASCLERAL: {
    code: '58821000052106',
    system: 'http://snomed.info/sct',
    display: 'Posterior juxtascleral route (qualifier value)',
  },
  SUBRETINAL: {
    code: '58831000052108',
    system: 'http://snomed.info/sct',
    display: 'Subretinal route (qualifier value)',
  },
  SUBLABIAL: {
    code: '66621000052103',
    system: 'http://snomed.info/sct',
    display: 'Sublabial use',
  },
} as const;
