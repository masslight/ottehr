import { create } from 'zustand';
import { VisitDataAndMappedData } from '../../shared/stores/appointment/parser/types';

const MAPPED_VISIT_DATA_INITIAL: VisitDataAndMappedData = { resources: {}, mappedData: {} };

export const useMappedVisitDataStore = create<VisitDataAndMappedData>()(() => ({
  ...MAPPED_VISIT_DATA_INITIAL,
}));
