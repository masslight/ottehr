export interface InviteConfig {
  authToken: string;
  projectId: string;
}

export interface DemoUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  npi?: string;
}

export interface Developer {
  email: string;
  firstName: string;
}

export type RoleKeyword = 'staff' | 'provider' | 'manager' | 'admin' | 'customer-support';

export interface RegularUser {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}
