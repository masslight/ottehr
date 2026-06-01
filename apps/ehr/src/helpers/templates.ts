import { TemplateCptCodeInfo } from 'utils';

export const formatCptCodeAndModifiersForDisplay = (info: TemplateCptCodeInfo): string => {
  return `${info.code}${info.modifiers.length ? `-${info.modifiers.map((mod) => mod.display).join(',-')}` : ''}`;
};
