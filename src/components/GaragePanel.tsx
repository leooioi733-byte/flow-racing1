import { useState } from 'react';
import { ArrowLeft, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';
import { getTeamDrivers, TEAMS_2026 } from '../data/grid2026';
import { UiStrings } from '../i18n/translations';
import {
  CarCustomization,
  GarageCameraPreset,
  resolveCarLivery,
  RIM_OPTIONS,
  TIRE_COMPOUND_OPTIONS,
} from '../types/menu';

interface GaragePanelProps {
  t: UiStrings;
  customization: CarCustomization;
  cameraPreset: GarageCameraPreset;
  onChangeCustomization: (next: CarCustomization) => void;
  onChangePreset: (preset: GarageCameraPreset) => void;
  onBack: () => void;
}

const CAMERA_KEYS: GarageCameraPreset[] = ['hero', 'front', 'side', 'cockpit'];

export function GaragePanel({
  t,
  customization,
  cameraPreset,
  onChangeCustomization,
  onChangePreset,
  onBack,
}: GaragePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const activeLivery = resolveCarLivery(customization);
  const teamDrivers = getTeamDrivers(activeLivery.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6"
    >
      {/* Top Bar: Back + Camera Angle Presets (keeps center viewport 100% clear) */}
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
            <span className="font-display font-bold tracking-[0.22em]">{t.garageTitle}</span>
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
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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

      {/* Collapsible Bottom Customization Dock */}
      <div className="flex flex-col items-center w-full">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="pointer-events-auto mb-1.5 flex items-center gap-1.5 px-3.5 py-1 rounded-t-xl bg-[#141e29]/92 hover:bg-[#1c2a3a] border border-b-0 border-white/14 text-[11px] font-semibold tracking-wider text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#7dd3fc]" />
              <span>{t.showDock}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#7dd3fc]" />
              <span>{t.hideDock}</span>
            </>
          )}
        </button>

        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto w-full max-w-[920px] rounded-2xl bg-[#131d28]/94 border border-white/14 shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 sm:px-5 sm:py-3.5 space-y-2.5"
          >
            {/* Row 1: 10 Official 2026 Team Liveries (Horizontal Scroll) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  {t.liveryLabel} · {activeLivery.name}
                </span>
                <span className="font-mono-tabular text-[11px] text-[#7dd3fc]">
                  {activeLivery.carModel} · #{activeLivery.number} {activeLivery.driverName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto flow-scroll pb-1">
                {TEAMS_2026.map((team) => {
                  const active = activeLivery.id === team.id;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      title={team.name}
                      onClick={() => {
                        const firstDriver = getTeamDrivers(team.id)[0];
                        onChangeCustomization({
                          ...customization,
                          livery: team.id,
                          driverId: firstDriver?.id,
                        });
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white/12 border-[#38bdf8] text-white'
                          : 'bg-[#1a2634] hover:bg-[#233345] border-white/10 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center rounded overflow-hidden border border-white/25 shrink-0 h-3.5 w-4">
                        <span className="flex-1 h-full" style={{ backgroundColor: team.colors.primary }} />
                        <span className="w-1 h-full" style={{ backgroundColor: team.colors.secondary }} />
                        <span className="w-1 h-full" style={{ backgroundColor: team.colors.accent }} />
                      </span>
                      <span className="font-display text-[11px] font-bold">{team.shortCode}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Driver Seat + Rim Finish + Tire Compound */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Driver 1 / Driver 2 Toggle */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  {t.career.driverSeatLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  {teamDrivers.map((driver) => {
                    const active = activeLivery.driverId === driver.id;
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
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#0b6884]/45 border-[#38bdf8] text-white'
                            : 'bg-[#1a2634] hover:bg-[#233345] border-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-mono-tabular text-[#7dd3fc]">#{driver.number}</span>
                        <span>{driver.name}</span>
                        <span className="font-mono-tabular text-[10px] text-slate-400">
                          {driver.overall}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>


              {/* Rim Finish Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  {t.rimsLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  {RIM_OPTIONS.map((rim) => {
                    const active = customization.rimFinish === rim.id;
                    return (
                      <button
                        key={rim.id}
                        type="button"
                        title={rim.name}
                        onClick={() =>
                          onChangeCustomization({ ...customization, rimFinish: rim.id })
                        }
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white/12 border-[#38bdf8] text-white'
                            : 'bg-[#1a2634] hover:bg-[#233345] border-white/10 text-slate-300'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: rim.colorHex }}
                        />
                        <span className="text-[11px]">{rim.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tire Compound Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  {t.tiresLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  {TIRE_COMPOUND_OPTIONS.map((tire) => {
                    const active = customization.tireCompound === tire.id;
                    return (
                      <button
                        key={tire.id}
                        type="button"
                        onClick={() =>
                          onChangeCustomization({ ...customization, tireCompound: tire.id })
                        }
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white/12 border-[#38bdf8] text-white'
                            : 'bg-[#1a2634] hover:bg-[#233345] border-white/10 text-slate-300'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tire.ringHex }}
                        />
                        <span>{tire.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
