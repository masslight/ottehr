import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  generatePracticeManagedQuestionnaireItemKey as generateKey,
  PracticeManagedQuestionnaireItem,
  QuestionnaireItemType,
} from 'utils';

export type ItemAction =
  | { type: 'ADD_PAGE' }
  | { type: 'ADD_CHILD_ITEM'; key: string }
  | { type: 'UPDATE_ITEM'; key: string; field: string; value: unknown }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'MOVE_ITEM_UP'; key: string }
  | { type: 'MOVE_ITEM_DOWN'; key: string }
  | { type: 'ADD_ANSWER_OPTION'; key: string }
  | { type: 'UPDATE_ANSWER_OPTION'; key: string; index: number; option: QuestionnaireItemAnswerOption }
  | { type: 'REMOVE_ANSWER_OPTION'; key: string; index: number }
  | { type: 'SET_ITEMS'; items: PracticeManagedQuestionnaireItem[] };

function updateItemInTree(
  items: PracticeManagedQuestionnaireItem[],
  key: string,
  updater: (item: PracticeManagedQuestionnaireItem) => PracticeManagedQuestionnaireItem
): PracticeManagedQuestionnaireItem[] {
  return items.map((item) => {
    if (item._key === key) return updater(item);
    if (item.item) return { ...item, item: updateItemInTree(item.item, key, updater) };
    return item;
  });
}

function removeItemFromTree(
  items: PracticeManagedQuestionnaireItem[],
  key: string
): PracticeManagedQuestionnaireItem[] {
  return items
    .filter((item) => item._key !== key)
    .map((item) => (item.item ? { ...item, item: removeItemFromTree(item.item, key) } : item));
}

function moveItemInList(
  items: PracticeManagedQuestionnaireItem[],
  key: string,
  direction: -1 | 1
): PracticeManagedQuestionnaireItem[] {
  const index = items.findIndex((item) => item._key === key);
  if (index >= 0) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < items.length) {
      const result = [...items];
      [result[index], result[newIndex]] = [result[newIndex], result[index]];
      return result;
    }
    return items;
  }
  return items.map((item) => (item.item ? { ...item, item: moveItemInList(item.item, key, direction) } : item));
}

export function itemsReducer(
  state: PracticeManagedQuestionnaireItem[],
  action: ItemAction
): PracticeManagedQuestionnaireItem[] {
  switch (action.type) {
    case 'ADD_PAGE':
      return [
        ...state,
        {
          _key: generateKey(),
          linkId: '',
          type: 'group',
          text: '',
          item: [
            {
              _key: generateKey(),
              linkId: '',
              type: 'string',
              text: '',
            },
          ],
        },
      ];

    case 'ADD_CHILD_ITEM':
      return updateItemInTree(state, action.key, (item) => ({
        ...item,
        item: [
          ...(item.item || []),
          {
            _key: generateKey(),
            linkId: '',
            type: 'string' as QuestionnaireItemType,
            text: '',
          },
        ],
      }));

    case 'UPDATE_ITEM':
      return updateItemInTree(state, action.key, (item) => ({
        ...item,
        [action.field]: action.value,
      }));

    case 'REMOVE_ITEM':
      return removeItemFromTree(state, action.key);

    case 'MOVE_ITEM_UP':
      return moveItemInList(state, action.key, -1);

    case 'MOVE_ITEM_DOWN':
      return moveItemInList(state, action.key, 1);

    case 'ADD_ANSWER_OPTION':
      return updateItemInTree(state, action.key, (item) => ({
        ...item,
        answerOption: [...(item.answerOption || []), { valueString: '' }],
      }));

    case 'UPDATE_ANSWER_OPTION':
      return updateItemInTree(state, action.key, (item) => ({
        ...item,
        answerOption: (item.answerOption || []).map((opt, i) => (i === action.index ? action.option : opt)),
      }));

    case 'REMOVE_ANSWER_OPTION':
      return updateItemInTree(state, action.key, (item) => ({
        ...item,
        answerOption: (item.answerOption || []).filter((_, i) => i !== action.index),
      }));

    case 'SET_ITEMS':
      return action.items;

    default:
      return state;
  }
}
