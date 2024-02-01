export interface Secrets {
  [secretName: string]: string;
}

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}
