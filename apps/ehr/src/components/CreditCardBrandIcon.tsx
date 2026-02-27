import { ReactElement } from 'react';

interface CreditCardBrandIconProps {
  brand: string;
}

const svgWrapperStyle = {
  display: 'inline-block',
  width: 26,
  height: 16,
  flexShrink: 0,
};

export default function CreditCardBrandIcon({ brand }: CreditCardBrandIconProps): ReactElement {
  switch (brand) {
    case 'visa':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <rect width="26" height="16" rx="2" fill="#1a1f71" />
          <text
            x="13"
            y="11.5"
            textAnchor="middle"
            fill="white"
            fontSize="7.5"
            fontWeight="900"
            fontFamily="Times New Roman, serif"
            letterSpacing="-0.3"
          >
            VISA
          </text>
        </svg>
      );

    case 'mastercard':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <rect width="26" height="16" rx="2" fill="#1c1c1c" />
          <circle cx="10" cy="8" r="5.5" fill="#EB001B" />
          <circle cx="16" cy="8" r="5.5" fill="#F79E1B" />
          <path d="M13,2.8 Q16,5.2 16,8 Q16,10.8 13,13.2 Q10,10.8 10,8 Q10,5.2 13,2.8 Z" fill="#FF5F00" />
        </svg>
      );

    case 'amex':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <rect width="26" height="16" rx="2" fill="#007BC1" />
          <text
            x="13"
            y="7.5"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="800"
            fontFamily="sans-serif"
            letterSpacing="0.3"
          >
            AMERICAN
          </text>
          <text
            x="13"
            y="13"
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
            fontWeight="800"
            fontFamily="sans-serif"
            letterSpacing="0.3"
          >
            EXPRESS
          </text>
        </svg>
      );

    case 'discover':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <rect width="26" height="16" rx="2" fill="#fff" />
          <rect width="26" height="16" rx="2" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          <circle cx="20" cy="8" r="6.5" fill="#FF6600" />
          <text
            x="10"
            y="10"
            textAnchor="middle"
            fill="#231f20"
            fontSize="4.5"
            fontWeight="900"
            fontFamily="sans-serif"
            letterSpacing="0.1"
          >
            DISC
          </text>
        </svg>
      );

    case 'unionpay':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <defs>
            <clipPath id="up-clip-brand-icon">
              <rect width="26" height="16" rx="2" />
            </clipPath>
          </defs>
          <rect width="26" height="16" rx="2" fill="#c0392b" />
          <g clipPath="url(#up-clip-brand-icon)">
            <rect x="0" y="0" width="26" height="16" fill="#c0392b" />
            <rect x="9" y="0" width="9" height="16" fill="#003087" />
            <rect x="18" y="0" width="8" height="16" fill="#00a651" />
          </g>
          <text x="13" y="10.5" textAnchor="middle" fill="white" fontSize="6" fontWeight="900" fontFamily="sans-serif">
            UP
          </text>
        </svg>
      );

    case 'jcb':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <defs>
            <clipPath id="jcb-clip-brand-icon">
              <rect width="26" height="16" rx="2" />
            </clipPath>
          </defs>
          <rect width="26" height="16" rx="2" fill="#fff" />
          <rect width="26" height="16" rx="2" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          <g clipPath="url(#jcb-clip-brand-icon)">
            <rect x="2" y="2" width="7" height="12" rx="3.5" fill="#003087" />
            <rect x="9.5" y="2" width="7" height="12" rx="3.5" fill="#cc0000" />
            <rect x="17" y="2" width="7" height="12" rx="3.5" fill="#007b40" />
            <text
              x="5.5"
              y="10.5"
              textAnchor="middle"
              fill="white"
              fontSize="6"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              J
            </text>
            <text
              x="13"
              y="10.5"
              textAnchor="middle"
              fill="white"
              fontSize="6"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              C
            </text>
            <text
              x="20.5"
              y="10.5"
              textAnchor="middle"
              fill="white"
              fontSize="6"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              B
            </text>
          </g>
        </svg>
      );

    case 'diners':
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <rect width="26" height="16" rx="2" fill="#fff" />
          <rect width="26" height="16" rx="2" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          <circle cx="11" cy="8" r="5" fill="none" stroke="#004a97" strokeWidth="1.2" />
          <circle cx="15" cy="8" r="5" fill="none" stroke="#004a97" strokeWidth="1.2" />
          <line x1="13" y1="3.1" x2="13" y2="12.9" stroke="#004a97" strokeWidth="1" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true" style={svgWrapperStyle}>
          <rect width="26" height="16" rx="2" fill="#1c1c1c" />
          <circle cx="10" cy="8" r="5.5" fill="#CC0000" opacity="0.95" />
          <circle cx="16" cy="8" r="5.5" fill="#0099CC" opacity="0.95" />
          <path d="M13,2.8 Q16,5.2 16,8 Q16,10.8 13,13.2 Q10,10.8 10,8 Q10,5.2 13,2.8 Z" fill="#6600cc" opacity="0.6" />
        </svg>
      );
  }
}
