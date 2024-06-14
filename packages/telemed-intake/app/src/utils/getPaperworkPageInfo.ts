import { useMemo } from 'react';
import { Location } from 'react-router-dom';
import { deepClone } from 'fast-json-patch';
import { PaperworkPage, Question } from 'ottehr-utils';

export const usePaperworkPageInfo = ({
  location,
  paperworkQuestions,
}: {
  location: Location;
  paperworkQuestions: PaperworkPage[] | undefined;
}): {
  slug: string;
  items: Question[];
  nextPage?: PaperworkPage;
  pageName: string;
  currentPage: PaperworkPage;
  currentIndex: number;
} => {
  return useMemo(() => {
    const slug = deepClone(location).pathname.replace('/paperwork/', '');
    if (!paperworkQuestions) {
      throw new Error('paperworkQuestions is not defined');
    }
    const currentPage = paperworkQuestions.find((pageTemp) => pageTemp.slug === slug);
    if (!currentPage) {
      throw new Error('currentPage is not defined');
    }
    const pageName = currentPage.page;
    const items = currentPage.questions;

    const currentIndex = paperworkQuestions.findIndex((pageTemp) => pageTemp.page === pageName);
    const nextPage = paperworkQuestions[currentIndex + 1];

    return { slug, items, nextPage, pageName, currentPage, currentIndex };
  }, [location, paperworkQuestions]);
};
