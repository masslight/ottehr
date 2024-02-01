// Fixes https://www.i18next.com/overview/typescript#argument-of-type-defaulttfuncreturn-is-not-assignable-to-parameter-of-type-xyz
export interface I18NextFix {
  returnNull: false;
}
