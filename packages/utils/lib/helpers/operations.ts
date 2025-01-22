import { Operation } from 'fast-json-patch';

export function addOperation(path: string, value: any): Operation {
  return {
    op: 'add',
    path,
    value,
  };
}

export function removeOperation(path: string): Operation {
  return {
    op: 'remove',
    path,
  };
}

export function addEmptyArrOperation(path: string): Operation {
  return {
    op: 'add',
    path,
    value: [],
  };
}

export function addOrReplaceOperation(examValue: any | undefined, path: string, value: any): Operation {
  return {
    op: examValue === undefined ? 'add' : 'replace',
    path,
    value,
  };
}

export function replaceOperation(path: string, value: any): Operation {
  return {
    op: 'replace',
    path,
    value,
  };
}
