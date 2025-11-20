export interface InPersonPatientTestData {
  firstName: string;
  lastName: string;
  email: string;
  birthSex: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  appointmentId: string;
  slot: string | undefined;
  location: string | null;
}

export interface InPersonPatientSelfTestData extends InPersonPatientTestData {
  state: string;
}
