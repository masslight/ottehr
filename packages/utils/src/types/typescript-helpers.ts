export type RequiredProps<T, TProps extends keyof T> = {
  [prop in keyof T]: T[prop];
} & {
  [prop in TProps]-?: T[prop];
};

export type RequiredAllProps<T> = {
  [prop in keyof T]-?: T[prop];
};
