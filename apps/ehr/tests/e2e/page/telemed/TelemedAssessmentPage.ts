import { Page } from '@playwright/test';
import { BaseAssessmentPage } from '../abstract/BaseAssessmentPage';

export class TelemedAssessmentPage extends BaseAssessmentPage {
  constructor(page: Page) {
    super(page);
  }
}
