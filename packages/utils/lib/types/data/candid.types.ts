export interface CandidToken {
  accessToken: string;
  expiresAt: Date;
}

export interface GetOrCreateCandidApiClientZambdaOutput {
  accessToken: string;
  expiresAt: string;
}
