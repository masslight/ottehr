import type { ExamCardComponent, ExamCardDropdownComponent, ExamCardMultiSelectComponent } from 'ottehr-types';

// Type guard functions for better type narrowing
export function isDropdownComponent(component: ExamCardComponent): component is ExamCardDropdownComponent {
  return component.type === 'dropdown';
}

export function isMultiSelectComponent(component: ExamCardComponent): component is ExamCardMultiSelectComponent {
  return component.type === 'multi-select';
}
