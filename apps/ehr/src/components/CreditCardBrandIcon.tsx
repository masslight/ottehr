import { ccIcon } from '@aaronfagan/ccicons';
import { ReactElement } from 'react';

interface CreditCardBrandIconProps {
  brand: string;
}

const svgWrapperStyle = {
  display: 'inline-block',
  width: 26,
  height: 16,
  flexShrink: 0,
  objectFit: 'contain' as const,
};

const brandIconNameMap: Record<string, string> = {
  visa: 'visa',
  mastercard: 'mastercard',
  amex: 'amex',
  discover: 'discover',
  unionpay: 'unionpay',
  jcb: 'jcb',
  diners: 'diners',
};

function getCardIconSource(brand: string): string {
  const normalizedBrand = brand.toLowerCase();
  const iconName = brandIconNameMap[normalizedBrand] ?? 'generic';

  try {
    return ccIcon(iconName, 'logo-border').src;
  } catch {
    return ccIcon('generic', 'logo-border').src;
  }
}

export default function CreditCardBrandIcon({ brand }: CreditCardBrandIconProps): ReactElement {
  const iconSource = getCardIconSource(brand);

  return <img src={iconSource} alt="" aria-hidden="true" style={svgWrapperStyle} />;
}
