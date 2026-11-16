import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Calendar,
  Check,
  ChevronRight,
  Cloud,
  CloudRain,
  Compass,
  Crown,
  Film,
  Flag,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sun,
  Trash2,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  BEARD_COLOR_SWATCHES,
  BEARD_STYLES,
  CareerRoundEntry,
  CareerSaveState,
  DEFAULT_CAREER_CHARACTER,
  deriveShortCode,
  getCareerConstructorStandings,
  getCareerDriverStandings,
  HAIR_COLOR_SWATCHES,
  HAIR_STYLES,
  HELMET_COLOR_PRESETS,
  HELMET_STYLES,
  isTeamTierUnlocked,
  SKIN_TONE_SWATCHES,
  STARTING_CAREER_TIERS,
} from '../data/careerStorage';
import { CIRCUIT_DEFINITIONS } from '../data/circuits';
import {
  getTeamById,
  getTeamDrivers,
  OfficialTeamId,
  TEAMS_2026,
  TeamTier,
} from '../data/grid2026';
import { UiStrings } from '../i18n/translations';
import {
  CarCustomization,
  CareerCharacter,
  ChampionshipTitleId,
  ConcreteWeather,
} from '../types/menu';
import { CharacterPortrait, HelmetPreviewSvg } from './CharacterPortrait';

export type CareerStep = 'entry' | 'character' | 'team-select' | 'hub';
type HubTab = 'overview' | 'calendar' | 'standings' | 'team';
type StandingsMode = 'drivers' | 'constructors';

interface CareerGridPanelProps {
  t: UiStrings;
  lang: 'en' | 'pt';
  step: CareerStep;
  onChangeStep: (next: CareerStep) => void;
  careerSave: CareerSaveState | null;
  customization: CarCustomization;
  onPreviewCustomization: (next: CarCustomization) => void;
  onCreateCareer: (character: CareerCharacter, teamId: OfficialTeamId) => void;
  onStartNextSeason: (nextTeamId?: OfficialTeamId) => void;
  onDeleteCareer: () => void;
  onStartCareerRace: () => void;
  onStartCareerPractice: () => void;
  savedReplaysCount?: number;
  onOpenReplayArchive?: () => void;
  onBackToHome: () => void;
}

function WeatherMiniIcon({ weather }: { weather: ConcreteWeather }) {
  if (weather === 'rainy') {
    return <CloudRain className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
  }
  if (weather === 'cloudy') {
    return <Cloud className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
  }
  return <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
}

export function CareerGridPanel({
  t,
  lang,
  step,
  onChangeStep,
  careerSave,
  customization,
  onPreviewCustomization,
  onCreateCareer,
  onStartNextSeason,
  onDeleteCareer,
  onStartCareerRace,
  onStartCareerPractice,
  savedReplaysCount = 0,
  onOpenReplayArchive,
  onBackToHome,
}: CareerGridPanelProps) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [draftCharacter, setDraftCharacter] = useState<CareerCharacter>(
    () => ({ ...DEFAULT_CAREER_CHARACTER }),
  );
  const [autoShortCode, setAutoShortCode] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<OfficialTeamId>(
    'bergstrom-motorsport',
  );
  const [isOffSeasonSelect, setIsOffSeasonSelect] = useState(false);

  const [hubTab, setHubTab] = useState<HubTab>('overview');
  const [standingsMode, setStandingsMode] = useState<StandingsMode>('drivers');
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [confirmDeleteSave, setConfirmDeleteSave] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const allowedTiers: TeamTier[] = isOffSeasonSelect && careerSave
    ? careerSave.unlockedTiers
    : STARTING_CAREER_TIERS;

  // Keep 3D showcase car & standing driver synced while creating character or picking team.
  // Debounced during character creation so typing in text fields never triggers synchronous
  // 3D canvas texture rebuilds on every single keystroke.
  const previewVisualKey = useMemo(
    () =>
      [
        selectedTeamId,
        draftCharacter.shortCode.trim() || deriveShortCode(draftCharacter.name),
        draftCharacter.number.trim() || '27',
        draftCharacter.hairStyle,
        draftCharacter.hairColor,
        draftCharacter.beardStyle,
        draftCharacter.beardColor,
        draftCharacter.skinColor,
        draftCharacter.helmetStyle,
        draftCharacter.helmetPrimaryHex,
        draftCharacter.helmetSecondaryHex,
        draftCharacter.helmetAccentHex,
      ].join('|'),
    [
      selectedTeamId,
      draftCharacter.name,
      draftCharacter.shortCode,
      draftCharacter.number,
      draftCharacter.hairStyle,
      draftCharacter.hairColor,
      draftCharacter.beardStyle,
      draftCharacter.beardColor,
      draftCharacter.skinColor,
      draftCharacter.helmetStyle,
      draftCharacter.helmetPrimaryHex,
      draftCharacter.helmetSecondaryHex,
      draftCharacter.helmetAccentHex,
    ],
  );

  useEffect(() => {
    if (step === 'character') {
      const timer = window.setTimeout(() => {
        const previewChar: CareerCharacter = {
          ...draftCharacter,
          name: draftCharacter.name.trim() || 'Driver',
          shortCode:
            draftCharacter.shortCode.trim() ||
            deriveShortCode(draftCharacter.name),
          number: draftCharacter.number.trim() || '27',
        };
        onPreviewCustomization({
          ...customization,
          livery: selectedTeamId,
          driverId: 'career-player',
          customDriver: previewChar,
        });
      }, 150);
      return () => window.clearTimeout(timer);
    } else if (step === 'team-select') {
      const charToUse =
        isOffSeasonSelect && careerSave
          ? careerSave.character
          : {
              ...draftCharacter,
              name: draftCharacter.name.trim() || 'Driver',
              shortCode:
                draftCharacter.shortCode.trim() ||
                deriveShortCode(draftCharacter.name),
              number: draftCharacter.number.trim() || '27',
            };
      onPreviewCustomization({
        ...customization,
        livery: selectedTeamId,
        driverId: 'career-player',
        customDriver: charToUse,
      });
    } else if (step === 'hub' && careerSave) {
      onPreviewCustomization({
        ...customization,
        livery: careerSave.teamId,
        driverId: 'career-player',
        customDriver: careerSave.character,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewVisualKey, isOffSeasonSelect, careerSave]);

  const driverStandings = useMemo(
    () => (careerSave ? getCareerDriverStandings(careerSave) : []),
    [careerSave],
  );
  const constructorStandings = useMemo(
    () => (careerSave ? getCareerConstructorStandings(careerSave) : []),
    [careerSave],
  );

  const handleBackNavigation = () => {
    setConfirmOverwrite(false);
    setConfirmDeleteSave(false);
    if (step === 'entry') {
      onBackToHome();
    } else if (step === 'character') {
      onChangeStep('entry');
    } else if (step === 'team-select') {
      if (isOffSeasonSelect) {
        setIsOffSeasonSelect(false);
        onChangeStep('hub');
      } else {
        onChangeStep('character');
      }
    } else {
      onChangeStep('entry');
    }
  };

  const handleStartNewCareerClick = () => {
    if (careerSave && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    setConfirmOverwrite(false);
    setIsOffSeasonSelect(false);
    setDraftCharacter({ ...DEFAULT_CAREER_CHARACTER });
    setAutoShortCode(true);
    setSelectedTeamId('bergstrom-motorsport');
    onChangeStep('character');
  };

  const handleContinueCareerClick = () => {
    if (!careerSave) return;
    setConfirmOverwrite(false);
    setIsOffSeasonSelect(false);
    setHubTab('overview');
    onChangeStep('hub');
  };

  const handleNameChange = (value: string) => {
    setDraftCharacter((prev) => ({
      ...prev,
      name: value.slice(0, 24),
      shortCode: autoShortCode ? deriveShortCode(value) : prev.shortCode,
    }));
  };

  const handleConfirmCharacter = () => {
    if (!draftCharacter.name.trim()) return;
    setIsOffSeasonSelect(false);
    // Ensure initial selected team is unlocked (midfield or developing)
    const currentTeam = getTeamById(selectedTeamId);
    if (!isTeamTierUnlocked(currentTeam.tier, STARTING_CAREER_TIERS)) {
      setSelectedTeamId('bergstrom-motorsport');
    }
    onChangeStep('team-select');
  };

  const handleSignContract = () => {
    if (isOffSeasonSelect && careerSave) {
      onStartNextSeason(selectedTeamId);
      setIsOffSeasonSelect(false);
      setHubTab('overview');
      onChangeStep('hub');
      return;
    }
    onCreateCareer(
      {
        ...draftCharacter,
        name: draftCharacter.name.trim(),
        shortCode:
          draftCharacter.shortCode.trim() ||
          deriveShortCode(draftCharacter.name),
        number: draftCharacter.number.trim() || '27',
      },
      selectedTeamId,
    );
    setHubTab('overview');
    onChangeStep('hub');
  };

  const activeTeamForPreview = getTeamById(selectedTeamId);
  const hasContinueSave = careerSave !== null;

  const activeHubTeam = careerSave ? getTeamById(careerSave.teamId) : null;
  const activeHubRound: CareerRoundEntry | null =
    careerSave && careerSave.currentRoundIndex < careerSave.calendar.length
      ? careerSave.calendar[careerSave.currentRoundIndex]
      : null;
  const isSeasonComplete =
    careerSave !== null &&
    careerSave.currentRoundIndex >= careerSave.calendar.length;

  const playerDriverStanding = driverStandings.find((d) => d.isPlayer);
  const playerTeamStanding = constructorStandings.find((c) => c.isPlayerTeam);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-hidden"
    >
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 pr-16 sm:pr-32">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#15202c]/92 hover:bg-[#1e2d3e] border border-white/14 text-xs font-semibold tracking-wider text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </button>

          <div className="hidden sm:flex items-center gap-2.5 text-xs text-white/85">
            <span className="font-display font-bold tracking-[0.22em]">
              {t.career.title}
            </span>
            <span aria-hidden="true" className="text-white/40">
              ·
            </span>
            <span className="text-white/70">{t.dragToOrbit}</span>
          </div>
        </div>

        {(step === 'entry' || step === 'hub') && onOpenReplayArchive && (
          <button
            type="button"
            onClick={onOpenReplayArchive}
            className="pointer-events-auto flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#15202c]/92 hover:bg-[#1e2d3e] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Film className="w-4 h-4 text-[#7dd3fc]" />
            <span>
              {t.replayArchive.buttonLabel}
              {savedReplaysCount > 0 ? ` (${savedReplaysCount})` : ''}
            </span>
          </button>
        )}
      </div>

      {/* Main Left-Anchored Career Surface — Right viewport stays clear for 3D Car + Driver */}
      <div className="flex-1 flex items-center py-2 sm:py-3 min-h-0">
        {/* STEP 1: CAREER ENTRY (CREATE OR CONTINUE) */}
        {step === 'entry' && (
          <div className="pointer-events-auto w-[min(460px,93vw)] max-h-full flex flex-col rounded-2xl bg-[#131d28]/95 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.48)] p-5 sm:p-6 overflow-y-auto flow-scroll">
            <div className="pb-4 border-b border-white/10">
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-[0.16em] text-white">
                {t.career.title}
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {t.career.entry.subtitle}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {/* Continue Career Button (Disabled when no save exists) */}
              <button
                type="button"
                disabled={!hasContinueSave}
                onClick={handleContinueCareerClick}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  hasContinueSave
                    ? 'bg-[#0b6884]/36 hover:bg-[#0b6884]/52 border-[#38bdf8]/65 text-white cursor-pointer'
                    : 'bg-[#0f1720]/70 border-white/8 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {careerSave ? (
                      <CharacterPortrait
                        skinColor={careerSave.character.skinColor}
                        hairStyle={careerSave.character.hairStyle}
                        hairColor={careerSave.character.hairColor}
                        beardStyle={careerSave.character.beardStyle}
                        beardColor={careerSave.character.beardColor}
                        suitPrimary={getTeamById(careerSave.teamId).colors.primary}
                        suitSecondary={getTeamById(careerSave.teamId).colors.secondary}
                        suitAccent={getTeamById(careerSave.teamId).colors.accent}
                        className="w-11 h-12 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold tracking-wide flex items-center gap-2">
                        <span>{t.career.entry.continueTitle}</span>
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                        {hasContinueSave
                          ? t.career.entry.continueDescActive
                          : t.career.entry.continueDescEmpty}
                      </p>
                    </div>
                  </div>
                  {hasContinueSave ? (
                    <ChevronRight className="w-5 h-5 text-[#7dd3fc] shrink-0" />
                  ) : null}
                </div>

                {careerSave && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-200 font-mono-tabular">
                    <span className="truncate font-sans font-semibold text-white">
                      {careerSave.character.name} · {getTeamById(careerSave.teamId).name}
                    </span>
                    <span className="text-[#7dd3fc] whitespace-nowrap ml-2">
                      {t.career.entry.roundShort}{' '}
                      {Math.min(
                        careerSave.calendar.length,
                        careerSave.currentRoundIndex + 1,
                      )}
                      /{careerSave.calendar.length} ·{' '}
                      {careerSave.driverStats.player?.points ?? 0}{' '}
                      {t.career.entry.pointsShort}
                    </span>
                  </div>
                )}
              </button>

              {/* Create New Career Button */}
              <button
                type="button"
                onClick={handleStartNewCareerClick}
                className="w-full text-left rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/55 p-4 text-white shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5 text-[#7dd3fc]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold tracking-wide">
                        {t.career.entry.createTitle}
                      </p>
                      <p className="text-xs text-slate-100/90 mt-0.5 leading-snug">
                        {t.career.entry.createDesc}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white shrink-0" />
                </div>
              </button>

              {/* Overwrite Confirmation if existing career save is present */}
              {confirmOverwrite && (
                <div className="rounded-xl bg-amber-950/60 border border-amber-400/45 p-3.5 space-y-2.5">
                  <p className="text-xs text-amber-100 leading-relaxed">
                    {t.career.entry.overwriteWarning}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartNewCareerClick}
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0b121a] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {t.career.entry.confirmOverwrite}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOverwrite(false)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1a2634] hover:bg-[#233245] border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {t.career.entry.cancelOverwrite}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CHARACTER CREATOR */}
        {step === 'character' && (
          <div className="pointer-events-auto w-[min(520px,93vw)] max-h-full flex flex-col rounded-2xl bg-[#131d28]/95 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.48)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-bold tracking-[0.16em] text-white truncate">
                  {t.career.creator.title}
                </h2>
                <p className="hidden sm:block text-[11px] text-slate-300 mt-0.5">
                  {t.career.creator.subtitle}
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-[#7dd3fc] whitespace-nowrap shrink-0">
                #{draftCharacter.number || '27'} ·{' '}
                {draftCharacter.shortCode || 'DRV'}
              </span>
            </div>

            {/* Scrollable Customization Controls (includes preview + inputs so mobile keyboard never crushes input) */}
            <div className="flex-1 overflow-y-auto flow-scroll pr-1 pt-3 space-y-3.5 min-h-[120px]">
              {/* Name, 3-Letter Code, Car Number — placed at top so always immediately accessible */}
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-12 sm:col-span-7">
                  <label
                    htmlFor="career-driver-name"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    {t.career.creator.nameLabel}
                  </label>
                  <input
                    ref={nameInputRef}
                    id="career-driver-name"
                    name="driverName"
                    type="text"
                    value={draftCharacter.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={(e) =>
                      e.currentTarget.scrollIntoView({ block: 'nearest' })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t.career.creator.namePlaceholder}
                    maxLength={24}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0d141d] border border-white/20 focus:border-[#38bdf8] focus:outline-none text-base sm:text-sm text-white placeholder:text-slate-400 select-text"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label
                    htmlFor="career-driver-code"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    {t.career.creator.codeLabel}
                  </label>
                  <input
                    id="career-driver-code"
                    name="driverCode"
                    type="text"
                    value={draftCharacter.shortCode}
                    onChange={(e) => {
                      setAutoShortCode(false);
                      setDraftCharacter((prev) => ({
                        ...prev,
                        shortCode: e.target.value
                          .replace(/[^a-zA-Z]/g, '')
                          .toUpperCase()
                          .slice(0, 3),
                      }));
                    }}
                    onFocus={(e) =>
                      e.currentTarget.scrollIntoView({ block: 'nearest' })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={3}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0d141d] border border-white/20 focus:border-[#38bdf8] focus:outline-none font-mono-tabular text-base sm:text-sm font-bold text-white uppercase text-center select-text"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label
                    htmlFor="career-driver-number"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    {t.career.creator.numberLabel}
                  </label>
                  <input
                    id="career-driver-number"
                    name="driverNumber"
                    type="text"
                    inputMode="numeric"
                    value={draftCharacter.number}
                    onChange={(e) =>
                      setDraftCharacter((prev) => ({
                        ...prev,
                        number: e.target.value.replace(/[^0-9]/g, '').slice(0, 2),
                      }))
                    }
                    onFocus={(e) =>
                      e.currentTarget.scrollIntoView({ block: 'nearest' })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    autoComplete="off"
                    maxLength={2}
                    className="w-full min-h-[42px] px-2 py-2 rounded-xl bg-[#0d141d] border border-white/20 focus:border-[#38bdf8] focus:outline-none font-mono-tabular text-base sm:text-sm font-bold text-white text-center select-text"
                  />
                </div>
              </div>

              {/* Live Driver & Helmet Preview Strip (clicking name focuses input) */}
              <div
                onClick={() => nameInputRef.current?.focus()}
                className="rounded-xl bg-[#0d151f] border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-text"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CharacterPortrait
                    skinColor={draftCharacter.skinColor}
                    hairStyle={draftCharacter.hairStyle}
                    hairColor={draftCharacter.hairColor}
                    beardStyle={draftCharacter.beardStyle}
                    beardColor={draftCharacter.beardColor}
                    suitPrimary={activeTeamForPreview.colors.primary}
                    suitSecondary={activeTeamForPreview.colors.secondary}
                    suitAccent={activeTeamForPreview.colors.accent}
                    className="w-12 h-14 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-white truncate">
                      {draftCharacter.name.trim() || t.career.creator.namePlaceholder}
                    </p>
                    <p className="text-[11px] text-slate-300 truncate">
                      {t.career.creator.hairStyles[draftCharacter.hairStyle]} ·{' '}
                      {t.career.creator.beardStyles[draftCharacter.beardStyle]}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center shrink-0">
                  <HelmetPreviewSvg
                    styleId={draftCharacter.helmetStyle}
                    primaryHex={draftCharacter.helmetPrimaryHex}
                    secondaryHex={draftCharacter.helmetSecondaryHex}
                    accentHex={draftCharacter.helmetAccentHex}
                    className="w-14 h-11"
                  />
                  <span className="text-[10px] text-slate-400">
                    {t.career.creator.helmetStyles[draftCharacter.helmetStyle]}
                  </span>
                </div>
              </div>

              {/* Skin Tone */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {t.career.creator.skinLabel}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {SKIN_TONE_SWATCHES.map((sw) => {
                    const active = draftCharacter.skinColor === sw.hex;
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        aria-label={sw.id}
                        onClick={() =>
                          setDraftCharacter((prev) => ({
                            ...prev,
                            skinColor: sw.hex,
                          }))
                        }
                        className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-transform cursor-pointer ${
                          active
                            ? 'border-[#38bdf8] scale-105'
                            : 'border-white/20 hover:border-white/50'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      >
                        {active && (
                          <Check className="w-4 h-4 text-[#0b121a] drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hair Style */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {t.career.creator.hairStyleLabel}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {HAIR_STYLES.map((styleId) => {
                    const active = draftCharacter.hairStyle === styleId;
                    return (
                      <button
                        key={styleId}
                        type="button"
                        onClick={() =>
                          setDraftCharacter((prev) => ({
                            ...prev,
                            hairStyle: styleId,
                          }))
                        }
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                          active
                            ? 'bg-[#0b6884] border-[#38bdf8] text-white'
                            : 'bg-[#182433] hover:bg-[#213144] border-white/10 text-slate-200'
                        }`}
                      >
                        {t.career.creator.hairStyles[styleId]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hair Color */}
              {draftCharacter.hairStyle !== 'bald' && (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    {t.career.creator.hairColorLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {HAIR_COLOR_SWATCHES.map((sw) => {
                      const active = draftCharacter.hairColor === sw.hex;
                      return (
                        <button
                          key={sw.id}
                          type="button"
                          aria-label={sw.id}
                          onClick={() =>
                            setDraftCharacter((prev) => ({
                              ...prev,
                              hairColor: sw.hex,
                            }))
                          }
                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-transform cursor-pointer ${
                            active
                              ? 'border-[#38bdf8] scale-105'
                              : 'border-white/20 hover:border-white/50'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        >
                          {active && (
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Beard Style */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {t.career.creator.beardStyleLabel}
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {BEARD_STYLES.map((styleId) => {
                    const active = draftCharacter.beardStyle === styleId;
                    return (
                      <button
                        key={styleId}
                        type="button"
                        onClick={() =>
                          setDraftCharacter((prev) => ({
                            ...prev,
                            beardStyle: styleId,
                          }))
                        }
                        className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                          active
                            ? 'bg-[#0b6884] border-[#38bdf8] text-white'
                            : 'bg-[#182433] hover:bg-[#213144] border-white/10 text-slate-200'
                        }`}
                      >
                        {t.career.creator.beardStyles[styleId]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Beard Color */}
              {draftCharacter.beardStyle !== 'none' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {t.career.creator.beardColorLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftCharacter((prev) => ({
                          ...prev,
                          beardColor: prev.hairColor,
                        }))
                      }
                      className="text-[11px] font-semibold text-[#7dd3fc] hover:text-white transition-colors cursor-pointer"
                    >
                      {t.career.creator.matchHairColor}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {BEARD_COLOR_SWATCHES.map((sw) => {
                      const active = draftCharacter.beardColor === sw.hex;
                      return (
                        <button
                          key={sw.id}
                          type="button"
                          aria-label={sw.id}
                          onClick={() =>
                            setDraftCharacter((prev) => ({
                              ...prev,
                              beardColor: sw.hex,
                            }))
                          }
                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-transform cursor-pointer ${
                            active
                              ? 'border-[#38bdf8] scale-105'
                              : 'border-white/20 hover:border-white/50'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        >
                          {active && (
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Helmet Style */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {t.career.creator.helmetStyleLabel}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {HELMET_STYLES.map((styleId) => {
                    const active = draftCharacter.helmetStyle === styleId;
                    return (
                      <button
                        key={styleId}
                        type="button"
                        onClick={() =>
                          setDraftCharacter((prev) => ({
                            ...prev,
                            helmetStyle: styleId,
                          }))
                        }
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0b6884]/50 border-[#38bdf8] text-white'
                            : 'bg-[#182433] hover:bg-[#213144] border-white/10 text-slate-200'
                        }`}
                      >
                        <HelmetPreviewSvg
                          styleId={styleId}
                          primaryHex={draftCharacter.helmetPrimaryHex}
                          secondaryHex={draftCharacter.helmetSecondaryHex}
                          accentHex={draftCharacter.helmetAccentHex}
                          className="w-11 h-8"
                        />
                        <span className="truncate max-w-full">
                          {t.career.creator.helmetStyles[styleId]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Helmet Color Palette */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {t.career.creator.helmetColorsLabel}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {HELMET_COLOR_PRESETS.map((preset) => {
                    const active =
                      draftCharacter.helmetPrimaryHex === preset.primary &&
                      draftCharacter.helmetAccentHex === preset.accent;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-label={preset.id}
                        onClick={() =>
                          setDraftCharacter((prev) => ({
                            ...prev,
                            helmetPrimaryHex: preset.primary,
                            helmetSecondaryHex: preset.secondary,
                            helmetAccentHex: preset.accent,
                          }))
                        }
                        className={`h-9 px-1.5 rounded-xl border-2 flex items-center gap-0.5 transition-transform cursor-pointer ${
                          active
                            ? 'border-[#38bdf8] scale-105 bg-[#0e1620]'
                            : 'border-white/15 bg-[#0e1620]/70 hover:border-white/40'
                        }`}
                      >
                        <span
                          className="w-4 h-6 rounded-l-md"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="w-2.5 h-6"
                          style={{ backgroundColor: preset.secondary }}
                        />
                        <span
                          className="w-2.5 h-6 rounded-r-md"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Continue CTA */}
            <div className="pt-3 mt-3 border-t border-white/10 shrink-0 space-y-2">
              {!draftCharacter.name.trim() && (
                <p className="text-[11px] text-amber-300/90">
                  {t.career.creator.nameRequiredHint}
                </p>
              )}
              <button
                type="button"
                disabled={!draftCharacter.name.trim()}
                onClick={handleConfirmCharacter}
                className={`group w-full flex items-center justify-between min-h-[44px] px-4 py-2 rounded-xl border font-display text-xs font-bold tracking-[0.16em] transition-all whitespace-nowrap ${
                  draftCharacter.name.trim()
                    ? 'bg-[#0b6884] hover:bg-[#0e7b9c] border-[#38bdf8]/50 text-white cursor-pointer shadow-[0_10px_24px_rgba(0,0,0,0.34)]'
                    : 'bg-[#182433] border-white/10 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <span>{t.career.creator.continueToTeam}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: TEAM SELECTION (MIDFIELD & DEVELOPING UNLOCKED INITIALLY) */}
        {step === 'team-select' && (
          <div className="pointer-events-auto w-[min(540px,93vw)] max-h-full flex flex-col rounded-2xl bg-[#131d28]/95 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.48)] p-4 sm:p-5">
            <div className="pb-3 border-b border-white/10 shrink-0">
              <h2 className="font-display text-base sm:text-lg font-bold tracking-[0.16em] text-white">
                {isOffSeasonSelect
                  ? t.career.teamSelect.newSeasonTitle
                  : t.career.teamSelect.title}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {t.career.teamSelect.tierRestrictionNote}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto flow-scroll pr-1 py-3 space-y-3 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEAMS_2026.map((team) => {
                  const unlocked = isTeamTierUnlocked(team.tier, allowedTiers);
                  const active = unlocked && selectedTeamId === team.id;
                  const teamCountry =
                    lang === 'pt' ? team.countryPt : team.countryEn;
                  const tierLabel =
                    lang === 'pt' ? team.tierLabelPt : team.tierLabelEn;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (unlocked) setSelectedTeamId(team.id);
                      }}
                      className={`flex items-stretch gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        !unlocked
                          ? 'bg-[#0d141d]/75 border-white/8 text-slate-400 cursor-not-allowed opacity-55'
                          : active
                            ? 'bg-[#0b6884]/40 border-[#38bdf8]/80 text-white cursor-pointer'
                            : 'bg-[#182432]/90 hover:bg-[#1f2e40] border-white/12 text-slate-200 cursor-pointer'
                      }`}
                    >
                      <div className="w-2 rounded-md overflow-hidden flex flex-col shrink-0 border border-white/15">
                        <span
                          className="flex-1"
                          style={{ backgroundColor: team.colors.primary }}
                        />
                        <span
                          className="h-2.5"
                          style={{ backgroundColor: team.colors.secondary }}
                        />
                        <span
                          className="h-2"
                          style={{ backgroundColor: team.colors.accent }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono-tabular text-[10px] text-slate-400">
                            {team.carModel}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-semibold">
                            {!unlocked && (
                              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={
                                unlocked ? 'text-[#7dd3fc]' : 'text-slate-400'
                              }
                            >
                              {tierLabel}
                            </span>
                          </span>
                        </div>
                        <p className="font-display text-xs font-bold text-white truncate mt-0.5">
                          {team.name}
                        </p>
                        <p className="text-[10px] text-slate-300 truncate">
                          {unlocked
                            ? `${teamCountry} · ${team.specs.powerHp} HP`
                            : t.career.teamSelect.lockedTierBadge}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Constructor Contract Detail */}
              {(() => {
                const teammate = getTeamDrivers(activeTeamForPreview.id)[0];
                return (
                  <div className="rounded-xl bg-[#0e1620] border border-white/12 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#7dd3fc] font-semibold">
                          {lang === 'pt'
                            ? activeTeamForPreview.tierLabelPt
                            : activeTeamForPreview.tierLabelEn}{' '}
                          · {activeTeamForPreview.carModel}
                        </p>
                        <h3 className="font-display text-sm font-bold text-white truncate mt-0.5">
                          {activeTeamForPreview.name}
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-300 whitespace-nowrap">
                        {t.career.teamSelect.targetLabel}:{' '}
                        <strong className="text-white font-mono-tabular">
                          {t.career.teamSelect.topTenTarget}{' '}
                          {activeTeamForPreview.careerMeta.targetFinishMax}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-lg bg-[#16212e] py-1.5 px-1">
                        <p className="text-[10px] text-slate-400">
                          {t.carSpecs.power}
                        </p>
                        <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                          {activeTeamForPreview.specs.powerHp} HP
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#16212e] py-1.5 px-1">
                        <p className="text-[10px] text-slate-400">
                          {t.carSpecs.topSpeed}
                        </p>
                        <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                          {activeTeamForPreview.specs.topSpeedKmh}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#16212e] py-1.5 px-1">
                        <p className="text-[10px] text-slate-400">
                          {t.career.aeroLabel}
                        </p>
                        <p className="font-mono-tabular text-xs font-semibold text-[#7dd3fc] mt-0.5">
                          {activeTeamForPreview.specs.aeroRating}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#16212e] py-1.5 px-1">
                        <p className="text-[10px] text-slate-400">
                          {t.career.chassisLabel}
                        </p>
                        <p className="font-mono-tabular text-xs font-semibold text-[#7dd3fc] mt-0.5">
                          {activeTeamForPreview.specs.chassisRating}
                        </p>
                      </div>
                    </div>

                    {teammate && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                        <span className="text-slate-300">
                          {t.career.teamSelect.teammateLabel}:{' '}
                          <strong className="text-white">
                            {teammate.name}
                          </strong>
                        </span>
                        <span className="font-mono-tabular text-[#7dd3fc] font-semibold">
                          #{teammate.number} · {t.career.overallLabel}{' '}
                          {teammate.overall}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 mt-2 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={handleSignContract}
                className="group w-full flex items-center justify-between min-h-[44px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/50 text-white shadow-[0_10px_24px_rgba(0,0,0,0.34)] transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.14em]">
                  <UserCheck className="w-4 h-4 text-[#7dd3fc]" />
                  {t.career.teamSelect.signContractCta}
                </span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CAREER CENTRAL HUB */}
        {step === 'hub' && careerSave && activeHubTeam && (
          <div className="pointer-events-auto w-[min(640px,94vw)] max-h-full flex flex-col rounded-2xl bg-[#131d28]/96 border border-white/14 shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-4 sm:p-5">
            {/* Central Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <CharacterPortrait
                  skinColor={careerSave.character.skinColor}
                  hairStyle={careerSave.character.hairStyle}
                  hairColor={careerSave.character.hairColor}
                  beardStyle={careerSave.character.beardStyle}
                  beardColor={careerSave.character.beardColor}
                  suitPrimary={activeHubTeam.colors.primary}
                  suitSecondary={activeHubTeam.colors.secondary}
                  suitAccent={activeHubTeam.colors.accent}
                  className="w-12 h-14 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span>
                      {t.career.hub.seasonLabel} {careerSave.seasonYear}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[#7dd3fc] font-semibold">
                      {t.career.hub.roundLabel}{' '}
                      {Math.min(
                        careerSave.calendar.length,
                        careerSave.currentRoundIndex + 1,
                      )}
                      /{careerSave.calendar.length}
                    </span>
                  </div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                    {careerSave.character.name}{' '}
                    <span className="font-mono-tabular text-xs font-semibold text-[#7dd3fc] ml-1">
                      #{careerSave.character.number}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 truncate">
                    {activeHubTeam.name} · {activeHubTeam.carModel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="rounded-xl bg-[#0d151f] border border-white/10 px-3 py-1.5 text-center">
                  <p className="text-[10px] text-slate-400">
                    {t.career.hub.driverPosLabel}
                  </p>
                  <p className="font-mono-tabular text-xs font-bold text-white">
                    P{playerDriverStanding?.position ?? '-'} ·{' '}
                    <span className="text-[#7dd3fc]">
                      {playerDriverStanding?.points ?? 0}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl bg-[#0d151f] border border-white/10 px-3 py-1.5 text-center">
                  <p className="text-[10px] text-slate-400">
                    {t.career.hub.teamPosLabel}
                  </p>
                  <p className="font-mono-tabular text-xs font-bold text-white">
                    P{playerTeamStanding?.position ?? '-'} ·{' '}
                    <span className="text-[#7dd3fc]">
                      {playerTeamStanding?.points ?? 0}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Central Navigation Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10 my-3 shrink-0">
              {(
                [
                  { id: 'overview', label: t.career.hub.tabs.overview, icon: Compass },
                  { id: 'calendar', label: t.career.hub.tabs.calendar, icon: Calendar },
                  { id: 'standings', label: t.career.hub.tabs.standings, icon: Trophy },
                  { id: 'team', label: t.career.hub.tabs.team, icon: Users },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = hubTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHubTab(id)}
                    className={`flex items-center justify-center gap-1.5 min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                      active
                        ? 'bg-[#0b6884] text-white'
                        : 'text-slate-300 hover:text-white hover:bg-white/6'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto flow-scroll pr-1 min-h-0">
              {/* TAB 1: CENTRAL / OVERVIEW */}
              {hubTab === 'overview' && (
                <div className="space-y-3">
                  {activeHubRound ? (
                    (() => {
                      const circuitDef = CIRCUIT_DEFINITIONS.find(
                        (c) => c.id === activeHubRound.circuitId,
                      );
                      return (
                        <div className="rounded-xl bg-[#0e1620] border border-[#38bdf8]/45 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold text-[#7dd3fc]">
                                {t.career.hub.nextGpTitle} ·{' '}
                                {t.career.hub.roundLabel} {activeHubRound.round}/
                                {careerSave.calendar.length}
                              </p>
                              <h3 className="font-display text-lg font-bold text-white mt-0.5">
                                {activeHubRound.gpName}
                              </h3>
                              <p className="text-xs text-slate-300">
                                {activeHubRound.location} ·{' '}
                                {circuitDef?.lengthKm ?? '5.4 km'} ·{' '}
                                {circuitDef?.corners ?? 14}{' '}
                                {t.circuitStats.corners}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-[#16212e] px-2.5 py-1.5 text-xs text-slate-200 shrink-0">
                              <WeatherMiniIcon weather={activeHubRound.weather} />
                              <span>{t.weathers[activeHubRound.weather]}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {activeHubRound.laps} {t.career.hub.lapsCount}
                              </span>
                            </div>
                          </div>

                          {circuitDef && (
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {lang === 'pt'
                                ? circuitDef.descriptionPt
                                : circuitDef.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={onStartCareerRace}
                              className="group flex-1 min-w-[200px] flex items-center justify-between min-h-[44px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/55 text-white shadow-[0_10px_24px_rgba(0,0,0,0.34)] transition-all cursor-pointer whitespace-nowrap"
                            >
                              <span className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.14em]">
                                <Flag className="w-4 h-4 text-[#7dd3fc]" />
                                {t.career.hub.startRaceCta}
                              </span>
                              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </button>

                            <button
                              type="button"
                              onClick={onStartCareerPractice}
                              className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#182433] hover:bg-[#223246] border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Play className="w-3.5 h-3.5 fill-current text-[#7dd3fc]" />
                              <span>{t.career.hub.practiceTrackCta}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* SEASON COMPLETE */
                    <div className="rounded-xl bg-[#0e1620] border border-amber-400/50 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-bold text-white">
                            {t.career.hub.seasonCompleteTitle}
                          </h3>
                          <p className="text-xs text-slate-300 mt-0.5">
                            {t.career.hub.seasonCompleteDesc}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onStartNextSeason()}
                          className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/50 text-xs font-display font-bold tracking-[0.12em] text-white cursor-pointer whitespace-nowrap"
                        >
                          {t.career.hub.startNextSeason} ({careerSave.seasonYear + 1})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOffSeasonSelect(true);
                            setSelectedTeamId(careerSave.teamId);
                            onChangeStep('team-select');
                          }}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#182433] hover:bg-[#223246] border border-white/15 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          {t.career.hub.changeTeamNextSeason}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Top 5 Snapshot + Teammate Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#0e1620] border border-white/10 p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>{t.career.hub.driversTableTab}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setStandingsMode('drivers');
                            setHubTab('standings');
                          }}
                          className="text-[11px] text-[#7dd3fc] hover:text-white cursor-pointer"
                        >
                          {t.career.hub.tabs.standings} →
                        </button>
                      </div>
                      <div className="divide-y divide-white/8 text-xs">
                        {driverStandings.slice(0, 5).map((row) => (
                          <div
                            key={row.id}
                            className={`py-1.5 flex items-center justify-between gap-2 ${
                              row.isPlayer ? 'text-[#7dd3fc] font-semibold' : 'text-slate-200'
                            }`}
                          >
                            <span className="truncate">
                              <span className="font-mono-tabular text-slate-400 mr-2">
                                {row.position}.
                              </span>
                              {row.name}
                            </span>
                            <span className="font-mono-tabular font-bold shrink-0">
                              {row.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0e1620] border border-white/10 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          {activeHubTeam.name}
                        </span>
                        <HelmetPreviewSvg
                          styleId={careerSave.character.helmetStyle}
                          primaryHex={careerSave.character.helmetPrimaryHex}
                          secondaryHex={careerSave.character.helmetSecondaryHex}
                          accentHex={careerSave.character.helmetAccentHex}
                          className="w-10 h-8"
                        />
                      </div>
                      {(() => {
                        const teammate = getTeamDrivers(activeHubTeam.id)[0];
                        return (
                          <div className="text-xs text-slate-300 space-y-1">
                            <p>
                              {t.career.teamSelect.teammateLabel}:{' '}
                              <strong className="text-white">
                                {teammate?.name}
                              </strong>
                            </p>
                            <p>
                              {t.carSpecs.power}:{' '}
                              <strong className="font-mono-tabular text-white">
                                {activeHubTeam.specs.powerHp} HP
                              </strong>{' '}
                              · {t.carSpecs.topSpeed}:{' '}
                              <strong className="font-mono-tabular text-white">
                                {activeHubTeam.specs.topSpeedKmh} km/h
                              </strong>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {t.career.teamSelect.targetLabel}:{' '}
                              {t.career.teamSelect.topTenTarget}{' '}
                              {activeHubTeam.careerMeta.targetFinishMax}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CALENDAR */}
              {hubTab === 'calendar' && (
                <div className="space-y-2">
                  {careerSave.calendar.map((round, idx) => {
                    const isNext =
                      !isSeasonComplete && idx === careerSave.currentRoundIndex;
                    const isExpanded = expandedRound === round.round;

                    return (
                      <div
                        key={round.round}
                        className={`rounded-xl border transition-colors ${
                          isNext
                            ? 'bg-[#0b6884]/32 border-[#38bdf8]/65'
                            : 'bg-[#0e1620] border-white/10'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRound(
                              round.completed
                                ? isExpanded
                                  ? null
                                  : round.round
                                : null,
                            )
                          }
                          className={`w-full p-3 flex items-center justify-between gap-3 text-left ${
                            round.completed ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono-tabular text-xs font-bold w-6 text-center text-[#7dd3fc] shrink-0">
                              {String(round.round).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <p className="font-display text-xs sm:text-sm font-bold text-white truncate">
                                {round.gpName}
                              </p>
                              <p className="text-[11px] text-slate-300 flex items-center gap-1.5 truncate">
                                <WeatherMiniIcon weather={round.weather} />
                                <span>{round.location}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular">
                                  {round.laps} {t.career.hub.lapsCount}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {round.completed ? (
                              <div>
                                <p className="font-mono-tabular text-xs font-bold text-emerald-300">
                                  P{round.playerPosition ?? '-'} · +
                                  {round.playerPoints} {t.career.entry.pointsShort}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                  {t.career.hub.winnerLabel}: {round.winnerName}
                                </p>
                              </div>
                            ) : isNext ? (
                              <span className="text-[11px] font-bold text-[#7dd3fc] whitespace-nowrap">
                                {t.career.hub.nextBadge}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                {t.career.hub.upcomingBadge}
                              </span>
                            )}
                          </div>
                        </button>

                        {isExpanded && round.classification.length > 0 && (
                          <div className="px-3 pb-3 pt-2 border-t border-white/10">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                              {round.classification.map((c) => (
                                <div
                                  key={c.id}
                                  className={`flex items-center justify-between px-2 py-1 rounded-lg ${
                                    c.isPlayer
                                      ? 'bg-[#0b6884]/35 text-white font-semibold'
                                      : 'bg-[#15202d] text-slate-200'
                                  }`}
                                >
                                  <span className="truncate">
                                    <span className="font-mono-tabular text-slate-400 mr-1.5">
                                      P{c.position}
                                    </span>
                                    {c.name}
                                  </span>
                                  <span className="font-mono-tabular text-[#7dd3fc] shrink-0 ml-2">
                                    +{c.points}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: STANDINGS (DRIVERS & CONSTRUCTORS TABLES) */}
              {hubTab === 'standings' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10">
                    <button
                      type="button"
                      onClick={() => setStandingsMode('drivers')}
                      className={`flex-1 min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        standingsMode === 'drivers'
                          ? 'bg-[#0b6884] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {t.career.hub.driversTableTab}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStandingsMode('constructors')}
                      className={`flex-1 min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        standingsMode === 'constructors'
                          ? 'bg-[#0b6884] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {t.career.hub.constructorsTableTab}
                    </button>
                  </div>

                  {standingsMode === 'drivers' ? (
                    <div className="rounded-xl bg-[#0e1620] border border-white/10 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="text-[10px] font-bold tracking-wider text-slate-400 border-b border-white/10">
                            <th className="py-2 px-2.5">{t.career.hub.colPos}</th>
                            <th className="py-2 px-2.5">{t.career.hub.colDriver}</th>
                            <th className="py-2 px-2.5 hidden sm:table-cell">
                              {t.career.hub.colTeam}
                            </th>
                            <th className="py-2 px-2 text-right">{t.career.hub.colWins}</th>
                            <th className="py-2 px-2 text-right">{t.career.hub.colPodiums}</th>
                            <th className="py-2 px-2.5 text-right">{t.career.hub.colPoints}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                          {driverStandings.map((row) => (
                            <tr
                              key={row.id}
                              className={
                                row.isPlayer
                                  ? 'bg-[#0b6884]/38 text-white font-semibold'
                                  : row.isTeammate
                                    ? 'bg-white/[0.03] text-slate-100'
                                    : 'text-slate-200'
                              }
                            >
                              <td className="py-2 px-2.5 font-mono-tabular font-bold">
                                {row.position}
                              </td>
                              <td className="py-2 px-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-1.5 h-3.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: row.teamColor }}
                                  />
                                  <span className="truncate">{row.name}</span>
                                  <span className="font-mono-tabular text-[10px] text-slate-400 shrink-0">
                                    #{row.number}
                                  </span>
                                  {row.isPlayer && (
                                    <span className="text-[10px] font-bold text-[#7dd3fc] shrink-0">
                                      ({t.career.hub.youBadge})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2.5 text-[11px] text-slate-300 hidden sm:table-cell truncate max-w-[140px]">
                                {row.teamName}
                              </td>
                              <td className="py-2 px-2 text-right font-mono-tabular text-slate-300">
                                {row.wins}
                              </td>
                              <td className="py-2 px-2 text-right font-mono-tabular text-slate-300">
                                {row.podiums}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono-tabular font-bold text-[#7dd3fc]">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-[#0e1620] border border-white/10 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="text-[10px] font-bold tracking-wider text-slate-400 border-b border-white/10">
                            <th className="py-2 px-2.5">{t.career.hub.colPos}</th>
                            <th className="py-2 px-2.5">{t.career.hub.colTeam}</th>
                            <th className="py-2 px-2 text-right">{t.career.hub.colWins}</th>
                            <th className="py-2 px-2 text-right">{t.career.hub.colPodiums}</th>
                            <th className="py-2 px-2.5 text-right">{t.career.hub.colPoints}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                          {constructorStandings.map((row) => (
                            <tr
                              key={row.team.id}
                              className={
                                row.isPlayerTeam
                                  ? 'bg-[#0b6884]/38 text-white font-semibold'
                                  : 'text-slate-200'
                              }
                            >
                              <td className="py-2 px-2.5 font-mono-tabular font-bold">
                                {row.position}
                              </td>
                              <td className="py-2 px-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2 h-4 rounded-sm shrink-0"
                                    style={{ backgroundColor: row.team.colors.primary }}
                                  />
                                  <span className="truncate">{row.team.name}</span>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {lang === 'pt'
                                      ? row.team.tierLabelPt
                                      : row.team.tierLabelEn}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono-tabular text-slate-300">
                                {row.wins}
                              </td>
                              <td className="py-2 px-2 text-right font-mono-tabular text-slate-300">
                                {row.podiums}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono-tabular font-bold text-[#7dd3fc]">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: TEAM & PROGRESSION */}
              {hubTab === 'team' && (
                <div className="space-y-3">
                  {/* Active Team Card */}
                  <div className="rounded-xl bg-[#0e1620] border border-white/12 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] text-[#7dd3fc] font-semibold">
                          {t.career.hub.contractOverviewTitle}
                        </p>
                        <h3 className="font-display text-base font-bold text-white mt-0.5">
                          {activeHubTeam.name} · {activeHubTeam.carModel}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-300">
                        {lang === 'pt'
                          ? activeHubTeam.tierLabelPt
                          : activeHubTeam.tierLabelEn}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-lg bg-[#16212e] py-2 px-1">
                        <p className="text-[10px] text-slate-400">{t.carSpecs.power}</p>
                        <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                          {activeHubTeam.specs.powerHp} HP
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#16212e] py-2 px-1">
                        <p className="text-[10px] text-slate-400">{t.carSpecs.topSpeed}</p>
                        <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                          {activeHubTeam.specs.topSpeedKmh}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#16212e] py-2 px-1">
                        <p className="text-[10px] text-slate-400">{t.career.aeroLabel}</p>
                        <p className="font-mono-tabular text-xs font-semibold text-[#7dd3fc] mt-0.5">
                          {activeHubTeam.specs.aeroRating}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#16212e] py-2 px-1">
                        <p className="text-[10px] text-slate-400">{t.career.chassisLabel}</p>
                        <p className="font-mono-tabular text-xs font-semibold text-[#7dd3fc] mt-0.5">
                          {activeHubTeam.specs.chassisRating}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tier Unlock Progression */}
                  <div className="rounded-xl bg-[#0e1620] border border-white/12 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Shield className="w-4 h-4 text-[#7dd3fc]" />
                      <span>{t.career.hub.tierUnlocksTitle}</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {(['developing', 'midfield', 'competitive', 'elite'] as TeamTier[]).map(
                        (tier) => {
                          const unlocked = careerSave.unlockedTiers.includes(tier);
                          return (
                            <div
                              key={tier}
                              className="flex items-center justify-between gap-2 rounded-lg bg-[#15202d] px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-white">
                                  {t.career.tiers[tier]}
                                </p>
                                {tier === 'competitive' && !unlocked && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {t.career.hub.competitiveUnlockHint}
                                  </p>
                                )}
                                {tier === 'elite' && !unlocked && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {t.career.hub.eliteUnlockHint}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                                  unlocked ? 'text-emerald-300' : 'text-slate-400'
                                }`}
                              >
                                {unlocked ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                                {unlocked
                                  ? t.career.hub.unlockedStatus
                                  : t.career.hub.lockedStatus}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {/* Trophies & Career Achievements */}
                  {(() => {
                    const achievements = careerSave.achievements ?? [];
                    const championships = achievements.filter(
                      (a) => a.type === 'championship',
                    );
                    const gpWins = achievements.filter(
                      (a) => a.type === 'race-win',
                    );
                    return (
                      <div className="rounded-xl bg-[#0e1620] border border-amber-400/25 p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            <Trophy className="w-4 h-4 text-amber-300" />
                            <span>{t.career.hub.achievementsTitle}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-mono-tabular">
                            <span className="text-amber-300 font-bold">
                              {championships.length} {t.career.hub.championshipsCountLabel}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-[#7dd3fc] font-bold">
                              {gpWins.length} {t.career.hub.gpWinsCountLabel}
                            </span>
                          </div>
                        </div>

                        {achievements.length === 0 ? (
                          <p className="text-[11px] text-slate-400">
                            {t.career.hub.noAchievementsHint}
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {achievements.slice(0, 8).map((ach) => {
                              const isChamp = ach.type === 'championship';
                              const cTitle = ach.titleId;
                              return (
                                <div
                                  key={ach.id}
                                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border ${
                                    isChamp
                                      ? 'bg-amber-500/12 border-amber-400/35'
                                      : 'bg-[#15202d] border-white/10'
                                  }`}
                                >
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                      isChamp
                                        ? 'bg-amber-400/20 text-amber-300'
                                        : 'bg-[#0b6884]/35 text-[#7dd3fc]'
                                    }`}
                                  >
                                    {isChamp ? (
                                      <Crown className="w-3.5 h-3.5" />
                                    ) : (
                                      <Award className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-white truncate">
                                      {isChamp && cTitle
                                        ? t.victory.titles[cTitle]
                                        : ach.gpName ?? ach.teamName}
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate">
                                      {t.victory.seasonPrefix} {ach.seasonYear} · {ach.teamName}
                                      {ach.points !== undefined
                                        ? ` · ${ach.points} ${t.career.entry.pointsShort}`
                                        : ''}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Delete Save Option */}
                  <div className="pt-1 flex items-center justify-end gap-2">
                    {!confirmDeleteSave ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSave(true)}
                        className="flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1a222d] hover:bg-rose-950/60 border border-rose-400/30 text-xs font-semibold text-rose-200 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.career.hub.resetCareerCta}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteSave(false);
                            onDeleteCareer();
                            onChangeStep('entry');
                          }}
                          className="flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t.career.hub.confirmResetCareer}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSave(false)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#182433] border border-white/15 text-xs font-semibold text-white cursor-pointer"
                        >
                          {t.career.entry.cancelOverwrite}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
