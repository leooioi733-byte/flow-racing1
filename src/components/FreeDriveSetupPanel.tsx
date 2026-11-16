import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  Film,
  Play,
  Sliders,
  Sun,
  Sunrise,
  Sunset,
  Wrench,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getTeamDrivers, TEAMS_2026 } from '../data/grid2026';
import { UiStrings } from '../i18n/translations';
import { createCircuitSvgProjection } from '../physics/formulaPhysics';
import {
  CarCustomization,
  CIRCUIT_OPTIONS,
  FreeDriveConfig,
  GarageCameraPreset,
  resolveCarLivery,
  RIM_OPTIONS,
  SteeringAssistLevel,
  TimeOfDay,
  TIRE_COMPOUND_OPTIONS,
  TrackCameraMode,
  TractionControlLevel,
  WeatherCondition,
} from '../types/menu';

interface FreeDriveSetupPanelProps {
  t: UiStrings;
  lang: 'en' | 'pt';
  mode?: 'free-drive' | 'quick-race';
  customization: CarCustomization;
  config: FreeDriveConfig;
  cameraPreset: GarageCameraPreset;
  onChangeCustomization: (next: CarCustomization) => void;
  onChangeConfig: (next: FreeDriveConfig) => void;
  onChangePreset: (preset: GarageCameraPreset) => void;
  onStartDrive: () => void;
  hasLastReplay?: boolean;
  onWatchLastReplay?: () => void;
  onBack: () => void;
}

type SetupTab = 'vehicle' | 'circuit' | 'assists' | 'environment';

const CAMERA_KEYS: GarageCameraPreset[] = ['hero', 'front', 'side', 'cockpit'];
const WEATHERS: WeatherCondition[] = ['auto', 'sunny', 'cloudy', 'rainy'];
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'sunset'];
const STEERING_LEVELS: SteeringAssistLevel[] = ['off', 'low', 'full'];
const TC_LEVELS: TractionControlLevel[] = ['off', 'medium', 'high'];
const TRACK_CAMS: TrackCameraMode[] = ['chase', 'tcam', 'cockpit', 'orbit'];
const RACE_LAPS_OPTIONS = [3, 5, 8];

export function FreeDriveSetupPanel({
  t,
  lang,
  mode = 'free-drive',
  customization,
  config,
  cameraPreset,
  onChangeCustomization,
  onChangeConfig,
  onChangePreset,
  onStartDrive,
  hasLastReplay = false,
  onWatchLastReplay,
  onBack,
}: FreeDriveSetupPanelProps) {
  const [activeTab, setActiveTab] = useState<SetupTab>('vehicle');
  const isQuickRace = mode === 'quick-race';

  const circuitPreviews = useMemo(
    () =>
      Object.fromEntries(
        CIRCUIT_OPTIONS.map((c) => [
          c.id,
          createCircuitSvgProjection(180, 84, 10, c.id),
        ]),
      ),
    [],
  );

  const selectedCar = resolveCarLivery(customization);
  const teamDrivers = getTeamDrivers(selectedCar.id);
  const selectedCircuit =
    CIRCUIT_OPTIONS.find((c) => c.id === config.circuitId) ?? CIRCUIT_OPTIONS[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6"
    >
      {/* Top Bar: Back + Camera Angles (car stays unobstructed in center-right) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pr-16 sm:pr-32">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#15202c]/92 hover:bg-[#1e2d3e] border border-white/14 text-xs font-semibold tracking-wider text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </button>

          <div className="hidden sm:flex items-center gap-2.5 text-xs text-white/85">
            <span className="font-display font-bold tracking-[0.22em]">
              {isQuickRace ? t.quickRace.title : t.freeDriveTitle}
            </span>
            <span aria-hidden="true" className="text-white/40">·</span>
            <span className="text-white/70">{t.dragToOrbit}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-[#141e29]/90 border border-white/12">
          <Camera className="w-3.5 h-3.5 text-[#7dd3fc] ml-2 mr-1 hidden sm:block" />
          {CAMERA_KEYS.map((key) => {
            const active = cameraPreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangePreset(key)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0b6884] text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/8'
                }`}
              >
                {t.cameraAngles[key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Left Compact Configuration Card + Right/Center Clear for 3D Car */}
      <div className="flex-1 flex items-center py-2 sm:py-3">
        <div className="pointer-events-auto w-[min(416px,92vw)] max-h-[76dvh] flex flex-col rounded-2xl bg-[#131d28]/94 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold tracking-[0.16em] text-white">
                {isQuickRace ? t.quickRace.title : t.freeDriveTitle}
              </h2>
              <p className="text-[11px] text-slate-300">
                {isQuickRace ? t.quickRace.subtitle : t.freeDriveSubtitle}
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#7dd3fc] whitespace-nowrap">
              {selectedCircuit.name}
            </span>
          </div>

          {/* 4-Tab Selector */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10 mb-3.5 shrink-0">
            {(
              [
                { id: 'vehicle', label: t.tabs.vehicle, icon: Wrench },
                { id: 'circuit', label: t.tabs.circuit, icon: Compass },
                { id: 'assists', label: t.tabs.assists, icon: Sliders },
                { id: 'environment', label: t.tabs.environment, icon: Sun },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                    active
                      ? 'bg-[#0b6884] text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/6'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Tab Body */}
          <div className="flex-1 overflow-y-auto flow-scroll pr-1 space-y-3.5 min-h-[210px]">
            {activeTab === 'vehicle' && (
              <div className="space-y-3">
                {/* 10 Official 2026 Teams Selector */}
                <div className="grid grid-cols-2 gap-2 max-h-[168px] overflow-y-auto flow-scroll pr-1">
                  {TEAMS_2026.map((team) => {
                    const active = selectedCar.id === team.id;
                    const tierLabel = lang === 'pt' ? team.tierLabelPt : team.tierLabelEn;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          const firstDriver = getTeamDrivers(team.id)[0];
                          onChangeCustomization({
                            ...customization,
                            livery: team.id,
                            driverId: firstDriver?.id,
                          });
                        }}
                        className={`text-left p-2 rounded-xl border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#0b6884]/35 border-[#38bdf8]/70 text-white'
                            : 'bg-[#192533]/85 hover:bg-[#203042] border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="flex items-center rounded overflow-hidden border border-white/30 shrink-0 h-3 w-5">
                            <span className="flex-1 h-full" style={{ backgroundColor: team.colors.primary }} />
                            <span className="w-1.5 h-full" style={{ backgroundColor: team.colors.secondary }} />
                            <span className="w-1 h-full" style={{ backgroundColor: team.colors.accent }} />
                          </span>
                          <span className="text-[9px] font-semibold text-[#7dd3fc] truncate">
                            {tierLabel}
                          </span>
                        </div>
                        <p className="mt-1.5 font-display text-[11px] font-bold truncate">
                          {team.name}
                        </p>
                        <p className="font-mono-tabular text-[10px] text-slate-300 truncate">
                          {team.carModel}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Official 2-Driver Seat Selector */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {t.career.driverSeatLabel}
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {teamDrivers.map((driver) => {
                      const active = selectedCar.driverId === driver.id;
                      return (
                        <button
                          key={driver.id}
                          type="button"
                          onClick={() =>
                            onChangeCustomization({
                              ...customization,
                              livery: driver.teamId,
                              driverId: driver.id,
                            })
                          }
                          className={`text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#0b6884]/40 border-[#38bdf8] text-white'
                              : 'bg-[#15202d] hover:bg-[#1c2b3c] border-white/10 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono-tabular text-[11px] font-bold text-[#7dd3fc]">
                              #{driver.number}
                            </span>
                            <span className="font-mono-tabular text-[10px] text-slate-300">
                              {t.career.overallLabel} {driver.overall}
                            </span>
                          </div>
                          <p className="font-display text-[11px] font-bold truncate mt-0.5">
                            {driver.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Car Basic Characteristics */}
                <div className="rounded-xl bg-[#0e1620] border border-white/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-xs font-bold text-white">
                      {selectedCar.carModel}
                    </span>
                    <span className="text-[11px] text-[#7dd3fc]">{selectedCar.aeroProfile}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[#16212e] py-1.5 px-2">
                      <p className="text-[10px] text-slate-400">{t.carSpecs.power}</p>
                      <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                        {selectedCar.powerHp} HP
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#16212e] py-1.5 px-2">
                      <p className="text-[10px] text-slate-400">{t.carSpecs.weight}</p>
                      <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                        {selectedCar.weightKg} kg
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#16212e] py-1.5 px-2">
                      <p className="text-[10px] text-slate-400">{t.carSpecs.topSpeed}</p>
                      <p className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                        {selectedCar.topSpeedKmh} km/h
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Rim & Tire Compound */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {t.rimsLabel}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      {RIM_OPTIONS.map((rim) => (
                        <button
                          key={rim.id}
                          type="button"
                          title={rim.name}
                          onClick={() =>
                            onChangeCustomization({ ...customization, rimFinish: rim.id })
                          }
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                            customization.rimFinish === rim.id
                              ? 'border-[#38bdf8] bg-white/12'
                              : 'border-white/12 bg-[#182432]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30"
                            style={{ backgroundColor: rim.colorHex }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {t.tiresLabel}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      {TIRE_COMPOUND_OPTIONS.map((tire) => (
                        <button
                          key={tire.id}
                          type="button"
                          title={tire.name}
                          onClick={() =>
                            onChangeCustomization({ ...customization, tireCompound: tire.id })
                          }
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                            customization.tireCompound === tire.id
                              ? 'border-[#38bdf8] bg-white/12'
                              : 'border-white/12 bg-[#182432]'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tire.ringHex }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'circuit' && (
              <div className="space-y-2.5">
                {CIRCUIT_OPTIONS.map((circuit) => {
                  const active = config.circuitId === circuit.id;
                  const circuitPreview = circuitPreviews[circuit.id];
                  const terrainColor = circuit.hasHills
                    ? 'rgba(45, 212, 191, 0.30)'
                    : 'rgba(56, 189, 248, 0.30)';
                  const horizonPath = circuit.hasHills
                    ? 'M 0 16 Q 48 6 95 14 T 180 10'
                    : 'M 0 10 Q 90 4 180 12';
                  return (
                    <button
                      key={circuit.id}
                      type="button"
                      onClick={() => onChangeConfig({ ...config, circuitId: circuit.id })}
                      className={`w-full text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#0b6884]/30 border-[#38bdf8]/65'
                          : 'bg-[#182432] border-white/10 hover:bg-[#1e2c3d]'
                      }`}
                    >
                      {/* Vector Track Preview + Terrain / Coastal Horizon Line */}
                      <div className="w-full h-20 rounded-lg bg-[#0d151f] border border-white/10 flex items-center justify-center relative overflow-hidden mb-2">
                        <svg
                          viewBox="0 0 180 84"
                          className="w-full h-full p-1.5"
                          aria-label={circuit.name}
                        >
                          <path
                            d={horizonPath}
                            fill="none"
                            stroke={terrainColor}
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                          <path
                            d={circuitPreview.pathD}
                            fill="none"
                            stroke="#475569"
                            strokeWidth="6.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d={circuitPreview.pathD}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="2.4"
                            strokeLinejoin="round"
                          />
                          {/* Start/Finish line marker */}
                          <line
                            x1={circuitPreview.startPt.x}
                            y1={circuitPreview.startPt.y - 5}
                            x2={circuitPreview.startPt.x}
                            y2={circuitPreview.startPt.y + 5}
                            stroke="#38bdf8"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute top-1.5 right-2.5 text-[10px] font-medium text-[#7dd3fc]">
                          {circuit.location}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-sm font-bold text-white truncate">
                          {circuit.name}
                        </h3>
                        <span className="font-mono-tabular text-[11px] text-slate-200 whitespace-nowrap shrink-0">
                          {circuit.lengthKm} · {circuit.corners}{' '}
                          {t.circuitStats.corners.toLowerCase()}
                        </span>
                      </div>

                      <p className="mt-1 text-[10px] font-medium text-[#7dd3fc] truncate">
                        {lang === 'pt' ? circuit.characterPt : circuit.characterEn}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                        {lang === 'pt' ? circuit.descriptionPt : circuit.description}
                      </p>
                    </button>
                  );
                })}

                {isQuickRace && (
                  <div className="rounded-xl bg-[#0e1620] border border-white/10 p-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {t.quickRace.lapsLabel}
                    </span>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0a1017] border border-white/10">
                      {RACE_LAPS_OPTIONS.map((laps) => (
                        <button
                          key={laps}
                          type="button"
                          onClick={() => onChangeConfig({ ...config, raceLaps: laps })}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            config.raceLaps === laps
                              ? 'bg-[#0b6884] text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {laps} {t.quickRace.lapsUnit}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 px-1">
                  {t.circuitStats.futureNote}
                </p>
              </div>
            )}

            {activeTab === 'assists' && (
              <div className="space-y-3">
                {/* Steering Assist */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {t.drivingSettings.steeringAssist}
                  </span>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10">
                    {STEERING_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() =>
                          onChangeConfig({ ...config, steeringAssist: lvl })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          config.steeringAssist === lvl
                            ? 'bg-[#0b6884] text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {t.drivingSettings.levels[lvl]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Traction Control */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {t.drivingSettings.tractionControl}
                  </span>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10">
                    {TC_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() =>
                          onChangeConfig({ ...config, tractionControl: lvl })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          config.tractionControl === lvl
                            ? 'bg-[#0b6884] text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {t.drivingSettings.levels[lvl]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ABS */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {t.drivingSettings.abs}
                  </span>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10">
                    {[true, false].map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => onChangeConfig({ ...config, abs: val })}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          config.abs === val
                            ? 'bg-[#0b6884] text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {val ? t.on : t.off}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Steering Sensitivity */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      {t.drivingSettings.sensitivity}
                    </span>
                    <span className="font-mono-tabular text-[#7dd3fc]">
                      {config.steeringSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={20}
                    step={1}
                    value={Math.round(config.steeringSensitivity * 10)}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        steeringSensitivity: Number(e.target.value) / 10,
                      })
                    }
                    className="w-full accent-[#0ea5e9] cursor-pointer"
                    aria-label={t.drivingSettings.sensitivity}
                  />
                </div>

                {/* Configurable Max Speed */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      {t.drivingSettings.maxSpeed}
                    </span>
                    <span className="font-mono-tabular text-[#7dd3fc]">
                      {config.maxSpeedKmh} km/h
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={380}
                    step={5}
                    value={config.maxSpeedKmh}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        maxSpeedKmh: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#0ea5e9] cursor-pointer"
                    aria-label={t.drivingSettings.maxSpeed}
                  />
                </div>

                {/* Preferred Camera */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-xs font-semibold text-slate-200">
                    {t.drivingSettings.preferredCam}
                  </span>
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10">
                    {TRACK_CAMS.map((cam) => (
                      <button
                        key={cam}
                        type="button"
                        onClick={() =>
                          onChangeConfig({ ...config, preferredCamera: cam })
                        }
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                          config.preferredCamera === cam
                            ? 'bg-[#0b6884] text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {t.trackCams[cam]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'environment' && (
              <div className="space-y-4">
                {/* Weather Condition */}
                <div>
                  <span className="text-xs font-semibold text-slate-200">
                    {t.weatherLabel}
                  </span>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {WEATHERS.map((w) => {
                      const active = config.weather === w;
                      const Icon =
                        w === 'auto'
                          ? CloudSun
                          : w === 'sunny'
                            ? Sun
                            : w === 'cloudy'
                              ? Cloud
                              : CloudRain;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => onChangeConfig({ ...config, weather: w })}
                          className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                            active
                              ? 'bg-[#0b6884]/45 border-[#38bdf8] text-white'
                              : 'bg-[#182432] hover:bg-[#1f2e40] border-white/10 text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-[#7dd3fc]" />
                          <span className="truncate max-w-full">{t.weathers[w]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time of Day */}
                <div>
                  <span className="text-xs font-semibold text-slate-200">
                    {t.timeLabel}
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {TIMES.map((tm) => {
                      const active = config.timeOfDay === tm;
                      const Icon =
                        tm === 'morning' ? Sunrise : tm === 'afternoon' ? Sun : Sunset;
                      return (
                        <button
                          key={tm}
                          type="button"
                          onClick={() => onChangeConfig({ ...config, timeOfDay: tm })}
                          className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            active
                              ? 'bg-[#0b6884]/45 border-[#38bdf8] text-white'
                              : 'bg-[#182432] hover:bg-[#1f2e40] border-white/10 text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-amber-300" />
                          <span>{t.times[tm]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlighted START DRIVE CTA + Watch Last Replay */}
          <div className="pt-3.5 mt-3 border-t border-white/10 shrink-0 flex flex-col gap-2">
            <button
              type="button"
              onClick={onStartDrive}
              className="group w-full flex items-center justify-between min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] active:scale-[0.985] border border-[#38bdf8]/45 text-white shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-2.5 font-display text-sm font-bold tracking-[0.2em]">
                <Play className="w-4 h-4 fill-current text-[#7dd3fc]" />
                {t.startDrive}
              </span>
              <ChevronRight className="w-4 h-4 text-white/85 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>

            {hasLastReplay && onWatchLastReplay && (
              <button
                type="button"
                onClick={onWatchLastReplay}
                className="w-full flex items-center justify-center gap-2 min-h-[38px] px-4 py-1.5 rounded-xl bg-[#182433] hover:bg-[#223246] border border-[#38bdf8]/35 text-xs font-semibold text-[#7dd3fc] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Film className="w-3.5 h-3.5" />
                <span>{t.replay.watchLastReplay}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
