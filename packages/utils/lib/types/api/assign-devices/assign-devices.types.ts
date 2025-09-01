export interface GetAssignDevices {
  deviceIds: string[];
  patientId: string;
  action: 'assign' | 'unassign';
}
