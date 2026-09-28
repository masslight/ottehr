/** How an expectation reads in a report line. Its own module so the corpus loader can use it without a cycle. */

import { Expectation } from './autochart-case-file';

export function describeExpectation(e: Expectation): string {
  switch (e.kind) {
    case 'anyOf':
      return `any of [${e.of.map(describeExpectation).join(' | ')}]`;
    case 'diagnosis':
      return `dx ${[e.codePrefix].flat().join('/')}${e.primary ? ' (primary)' : ''}`;
    case 'ros':
      return `ros ${e.finding} ${e.baseKey.replace(/^ros-/, '')}`;
    case 'exam':
      return `exam ${e.field ?? e.display}`;
    case 'vital':
      return `${e.field.replace(/^vital-/, '')} ${e.value}${e.unit ?? ''}`;
    case 'bloodPressure':
      return `blood pressure ${e.systolic}/${e.diastolic}`;
    case 'medication':
      return `medication ${e.name}${e.strength ? ` ${e.strength}` : ''}`;
    case 'allergy':
      return `allergy ${e.name}`;
    case 'condition':
      return `condition ${e.name ?? e.codePrefix}`;
    case 'surgicalHistory':
      return `surgical history ${e.display}`;
    case 'hospitalization':
      return `hospitalization ${e.display}`;
    case 'em':
      return `E&M ${e.codes.join('/')}`;
    case 'disposition':
      return `disposition ${e.type ?? 'any'}${e.followUpInDays !== undefined ? ` in ${e.followUpInDays}d` : ''}`;
    case 'instruction':
      return `instruction ${e.text}`;
    case 'note':
      return `${e.field} ${e.text}`;
    default:
      return JSON.stringify(e);
  }
}
