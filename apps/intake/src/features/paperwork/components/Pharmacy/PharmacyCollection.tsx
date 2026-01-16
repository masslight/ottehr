import { QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useEffect, useState } from 'react';
import { PHARMACY_COLLECTION_LINK_IDS, PlacesResult } from 'utils';
import { useQRState } from '../../useFormHelpers';
import { PharmacyDisplay } from './PharmacyDisplay';
import { PharmacySearch } from './PharmacySearch';

export interface PharmacyCollectionProps {
  onChange: (e: any) => void;
}

export const PharmacyCollection: FC<PharmacyCollectionProps> = (props: PharmacyCollectionProps) => {
  const { onChange } = props;
  const [selectedPlace, setSelectedPlace] = useState<PlacesResult | null>(null);
  const { formValues } = useQRState();

  const pharmacyCollectionItemValues = formValues[PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection]?.item;

  useEffect(() => {
    if (!pharmacyCollectionItemValues?.length) return;

    type PreviousPharmData = {
      pharmName?: string;
      pharmAddress?: string;
      pharmPlacesId?: string;
      pharmDsId?: string;
      hasAnyData: boolean;
    };

    const existing = pharmacyCollectionItemValues?.reduce(
      (acc: PreviousPharmData, item: QuestionnaireResponseItem) => {
        const answer = item.answer?.[0]?.valueString;
        if (!answer) return acc;

        acc.hasAnyData = true;

        switch (item.linkId) {
          case PHARMACY_COLLECTION_LINK_IDS.placesId:
            acc.pharmPlacesId = answer;
            break;
          case PHARMACY_COLLECTION_LINK_IDS.placesName:
            acc.pharmName = answer;
            break;
          case PHARMACY_COLLECTION_LINK_IDS.placesAddress:
            acc.pharmAddress = answer;
            break;
          case PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId:
            acc.pharmDsId = answer;
            break;
        }

        return acc;
      },
      { hasAnyData: false }
    );

    if (existing.hasAnyData) {
      setSelectedPlace({
        name: existing.pharmName ?? '',
        address: existing.pharmAddress ?? '',
        placesId: existing.pharmPlacesId ?? '',
      });
    }
  }, [pharmacyCollectionItemValues]);

  return selectedPlace ? (
    <PharmacyDisplay
      selectedPlace={selectedPlace}
      setSelectedPlace={setSelectedPlace}
      onChange={onChange}
    ></PharmacyDisplay>
  ) : (
    <PharmacySearch onChange={onChange} setSelectedPlace={setSelectedPlace}></PharmacySearch>
  );
};
