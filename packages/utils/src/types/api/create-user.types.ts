export interface CreateUserParams {
  email: string;
  applicationID: string;
  firstName: string;
  lastName: string;
}

export interface CreateUserOutput {
  userID: string;
}
