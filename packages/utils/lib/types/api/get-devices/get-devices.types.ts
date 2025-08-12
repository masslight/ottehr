export interface GetDevicesResponse {
  status: number;
  output: Output;
}

export interface Output {
  message: string;
  devices: Device[];
  total: number;
}

export interface Device {
  id: string;
  resourceType: string;
  identifier: Identifier[];
  deviceName: DeviceName[];
  meta: Meta;
  patient?: Patient;
  manufacturer?: string;
}

export interface Identifier {
  value: string;
  use: string;
  type: Type;
}

export interface Type {
  text: string;
  coding: Coding[];
}

export interface Coding {
  system: string;
  code: string;
  display: string;
}

export interface DeviceName {
  name: string;
  type: string;
}

export interface Meta {
  versionId: string;
  lastUpdated: string;
}

export interface Patient {
  type: string;
  reference: string;
}

export interface DeviceResponse {
  id: string;
  deviceName: { name: string }[];
  manufacturer?: string;
  meta: {
    lastUpdated: string;
  };
}

export interface UnassinedDeviceResponse {
  id: string;
  deviceName: { name: string }[];
}

export interface DeviceColumns {
  id: string;
  name: string;
  manufacturer: string;
  lastUpdated: string;
}
