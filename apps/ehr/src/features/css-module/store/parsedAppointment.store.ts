import { create } from 'zustand';
import { VisitDataAndMappedData } from '../parser';

const MAPPED_VISIT_DATA_INITIAL: VisitDataAndMappedData = { data: {}, mappedData: {} };

export const useMappedVisitDataStore = create<VisitDataAndMappedData>()(() => ({
  ...MAPPED_VISIT_DATA_INITIAL,
}));
