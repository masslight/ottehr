import { QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useMemo } from 'react';
import { dataTestIds } from 'ui-components';
import { PharmacyDisplay, PharmacySearch } from 'ui-components';
import {
  clearPharmacyCollectionAnswerSet,
  makePharmacyCollectionAnswerSetForQR,
  PHARMACY_COLLECTION_LINK_IDS,
  PharmacyCollectionAnswerSetInput,
} from 'utils';
import { usePaperworkContext } from '../context';
import { useQRState } from '../hooks/useFormHelpers';

export interface PharmacyCollectionProps {
  onChange: (e: any) => void;
}

export const PharmacyCollection: FC<PharmacyCollectionProps> = (props: PharmacyCollectionProps) => {
  const { onChange } = props;
  const { formValues } = useQRState();

  const { paperworkComponentHelpers } = usePaperworkContext();
  const { handleSearchPlaces } = paperworkComponentHelpers;

  const pharmacyCollectionItemValues = formValues[PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection]?.item;

  const selectedPlace = useMemo(() => {
    if (!pharmacyCollectionItemValues?.length) return null;

    const existing = pharmacyCollectionItemValues.reduce(
      (
        acc: { name?: string; address?: string; placesId?: string; hasAnyData: boolean },
        item: QuestionnaireResponseItem
      ) => {
        const answer = item.answer?.[0]?.valueString;
        if (!answer) return acc;

        acc.hasAnyData = true;

        switch (item.linkId) {
          case PHARMACY_COLLECTION_LINK_IDS.placesId:
            acc.placesId = answer;
            break;
          case PHARMACY_COLLECTION_LINK_IDS.placesName:
            acc.name = answer;
            break;
          case PHARMACY_COLLECTION_LINK_IDS.placesAddress:
            acc.address = answer;
            break;
        }

        return acc;
      },
      { hasAnyData: false }
    );

    return existing.hasAnyData
      ? {
          name: existing.name ?? '',
          address: existing.address ?? '',
          placesId: existing.placesId ?? '',
        }
      : null;
  }, [pharmacyCollectionItemValues]);

  const clearPharmacyData = (): void => {
    const answerSet = clearPharmacyCollectionAnswerSet();
    onChange(answerSet);
  };

  const handlePharmacySelection = (input: PharmacyCollectionAnswerSetInput): void => {
    const answerSet = makePharmacyCollectionAnswerSetForQR(input);
    onChange(answerSet);
  };

  return selectedPlace ? (
    <PharmacyDisplay
      selectedPlace={selectedPlace}
      clearPharmacyData={clearPharmacyData}
      dataTestIds={dataTestIds.preferredPharmacy.pharmacySearchDisplay}
    ></PharmacyDisplay>
  ) : (
    <PharmacySearch
      handlePharmacySelection={handlePharmacySelection}
      searchPlaces={handleSearchPlaces}
      dataTestId={dataTestIds.preferredPharmacy.pharmacySearch}
    ></PharmacySearch>
  );
};
