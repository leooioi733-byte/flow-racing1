import {
  BeardStyleId,
  HairStyleId,
  HelmetStyleId,
} from '../types/menu';

interface CharacterPortraitProps {
  skinColor: string;
  hairStyle: HairStyleId;
  hairColor: string;
  beardStyle: BeardStyleId;
  beardColor: string;
  suitPrimary?: string;
  suitSecondary?: string;
  suitAccent?: string;
  className?: string;
}

export function CharacterPortrait({
  skinColor,
  hairStyle,
  hairColor,
  beardStyle,
  beardColor,
  suitPrimary = '#0B6884',
  suitSecondary = '#101A24',
  suitAccent = '#38BDF8',
  className = 'w-14 h-16 shrink-0',
}: CharacterPortraitProps) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      {/* F1 Racing Suit Torso & Shoulders */}
      <path
        d="M 8 70 L 12 43 C 13.5 37.5 18 35 24 35 L 40 35 C 46 35 50.5 37.5 52 43 L 56 70 Z"
        fill={suitPrimary}
      />
      <path d="M 12 43 L 20 36 L 21.5 46 L 10.5 50 Z" fill={suitSecondary} />
      <path d="M 52 43 L 44 36 L 42.5 46 L 53.5 50 Z" fill={suitSecondary} />
      <rect x="19" y="45" width="26" height="7" rx="1.5" fill={suitSecondary} />
      <rect x="19" y="52" width="26" height="2.4" fill={suitAccent} />
      <rect x="31.2" y="35" width="1.6" height="35" fill="rgba(255,255,255,0.45)" />

      {/* Fireproof High Collar & Neck */}
      <rect x="26.5" y="29" width="11" height="7" rx="2" fill={skinColor} />
      <rect x="24.5" y="31.5" width="15" height="6" rx="2" fill={suitSecondary} />
      <rect x="26.5" y="33.2" width="11" height="2.2" fill={suitAccent} />

      {/* Curly / Back Hair Silhouette Behind Head */}
      {hairStyle === 'curly' && (
        <g fill={hairColor}>
          <circle cx="21" cy="14" r="6" />
          <circle cx="43" cy="14" r="6" />
          <circle cx="25" cy="8.5" r="6.5" />
          <circle cx="39" cy="8.5" r="6.5" />
          <circle cx="32" cy="7" r="7" />
        </g>
      )}

      {/* Signature Eyeless Flow Face */}
      <rect x="22" y="10" width="20" height="22" rx="9.5" fill={skinColor} />

      {/* Beard Styles */}
      {beardStyle === 'stubble' && (
        <path
          d="M 22.4 22.5 C 22.4 28.5 26.2 32 32 32 C 37.8 32 41.6 28.5 41.6 22.5 L 39.2 24.5 C 37.2 27.6 34.8 28.6 32 28.6 C 29.2 28.6 26.8 27.6 24.8 24.5 Z"
          fill={beardColor}
          opacity={0.42}
        />
      )}
      {beardStyle === 'short' && (
        <path
          d="M 22 21.8 C 22 28.8 26 32.5 32 32.5 C 38 32.5 42 28.8 42 21.8 L 39.5 23.6 C 37.6 26.8 35 27.9 32 27.9 C 29 27.9 26.4 26.8 24.5 23.6 Z"
          fill={beardColor}
        />
      )}
      {beardStyle === 'full' && (
        <path
          d="M 21.2 21 C 21 29.8 25.4 35.5 32 35.5 C 38.6 35.5 43 29.8 42.8 21 L 39.6 22.8 C 37.8 26.2 35.2 27 32 27 C 28.8 27 26.2 26.2 24.4 22.8 Z"
          fill={beardColor}
        />
      )}
      {beardStyle === 'goatee' && (
        <path
          d="M 27 26.5 C 27 31 29.2 33.4 32 33.4 C 34.8 33.4 37 31 37 26.5 C 35.2 27.6 33.6 28 32 28 C 30.4 28 28.8 27.6 27 26.5 Z"
          fill={beardColor}
        />
      )}

      {/* Hair Styles */}
      {hairStyle === 'buzz' && (
        <path
          d="M 22.2 17 C 22.2 11.2 26.2 8.2 32 8.2 C 37.8 8.2 41.8 11.2 41.8 17 L 39.8 14.5 C 37 13 34.5 12.6 32 12.6 C 29.5 12.6 27 13 24.2 14.5 Z"
          fill={hairColor}
          opacity={0.85}
        />
      )}
      {hairStyle === 'short' && (
        <path
          d="M 21.2 17.5 C 21.2 9.8 25.4 6.5 32 6.5 C 38.6 6.5 42.8 9.8 42.8 17.5 L 40.5 14.8 L 35.8 15.8 L 32 12.8 L 27.5 15.6 L 23.6 14.8 Z"
          fill={hairColor}
        />
      )}
      {hairStyle === 'spiky' && (
        <path
          d="M 21.2 17.2 L 22 10 L 26 12 L 28.5 5.5 L 32 10.2 L 35.5 5.2 L 38.2 11.8 L 42 9.5 L 42.8 17.2 L 39.8 14.5 L 35.2 15.2 L 32 13 L 28.4 15.2 L 24 14.5 Z"
          fill={hairColor}
        />
      )}
      {hairStyle === 'swept' && (
        <path
          d="M 21 18 C 20.8 9.5 25.8 6 33.4 6.2 C 39.5 6.4 43.2 10.4 42.8 17.6 L 40.2 14.4 C 36.2 13 31 13.8 25.8 16.4 L 22.5 15.6 Z"
          fill={hairColor}
        />
      )}
      {hairStyle === 'curly' && (
        <g fill={hairColor}>
          <circle cx="23.5" cy="12" r="4.8" />
          <circle cx="29" cy="10.2" r="5" />
          <circle cx="35" cy="10.2" r="5" />
          <circle cx="40.5" cy="12" r="4.8" />
        </g>
      )}
    </svg>
  );
}

interface HelmetPreviewSvgProps {
  styleId: HelmetStyleId;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  className?: string;
}

export function HelmetPreviewSvg({
  styleId,
  primaryHex,
  secondaryHex,
  accentHex,
  className = 'w-14 h-12 shrink-0',
}: HelmetPreviewSvgProps) {
  return (
    <svg viewBox="0 0 64 52" className={className} aria-hidden="true">
      {/* Rear Aero Spoiler */}
      <path d="M 8 24 L 16 20 L 18 28 L 9 29 Z" fill={secondaryHex} />

      {/* Main Helmet Shell */}
      <path
        d="M 14 38 C 12 22 20 8 36 8 C 48 8 54 16 55 27 C 55.6 34 52 41 44 43 L 19 43 C 16 43 14.4 40.8 14 38 Z"
        fill={primaryHex}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
      />

      {/* Style-Specific Graphics */}
      {styleId === 'classic' && (
        <>
          <path d="M 15 32 L 54 32 L 52 38 L 16 38 Z" fill={secondaryHex} />
          <path d="M 15.5 34.5 L 53.5 34.5 L 53 36.6 L 15.8 36.6 Z" fill={accentHex} />
        </>
      )}

      {styleId === 'aero-stripe' && (
        <>
          <path d="M 20 12 L 42 10 L 34 22 L 16 24 Z" fill={accentHex} />
          <path d="M 17 34 L 51 28 L 49 35 L 18 39 Z" fill={secondaryHex} />
        </>
      )}

      {styleId === 'apex-split' && (
        <>
          <path
            d="M 14 38 C 12 22 20 8 36 8 L 31 43 L 19 43 C 16 43 14.4 40.8 14 38 Z"
            fill={secondaryHex}
          />
          <path d="M 34.5 8 L 38 8 L 33 43 L 29.5 43 Z" fill={accentHex} />
        </>
      )}

      {styleId === 'monolith' && (
        <path
          d="M 22 40 L 45 40 L 44 42.8 L 21 42.8 Z"
          fill={accentHex}
          opacity={0.85}
        />
      )}

      {/* Dark Tinted Visor */}
      <path
        d="M 31 19 C 38 18 48 18.5 54.4 21.5 C 55 24.5 54.6 27.6 53.2 29.2 C 47 28.6 37 28.5 31 27.4 C 29.2 24.8 29.2 21.4 31 19 Z"
        fill="#07111a"
        stroke={accentHex}
        strokeWidth="1.2"
      />
      {/* Visor Highlight */}
      <path
        d="M 33.5 21.2 L 45 21.6 L 42.5 23.2 L 33.5 22.8 Z"
        fill="rgba(255,255,255,0.28)"
      />
    </svg>
  );
}
