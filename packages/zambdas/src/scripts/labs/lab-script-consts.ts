import { LAB_DR_TYPE_TAG } from 'utils';

export const EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];

export const DR_UNSOLICITED_RESULT_TAG = {
  system: LAB_DR_TYPE_TAG.system,
  code: LAB_DR_TYPE_TAG.code.unsolicited,
  display: LAB_DR_TYPE_TAG.display.unsolicited,
};

export const DR_REFLEX_TAG = {
  system: LAB_DR_TYPE_TAG.system,
  code: LAB_DR_TYPE_TAG.code.reflex,
  display: LAB_DR_TYPE_TAG.display.reflex,
};
