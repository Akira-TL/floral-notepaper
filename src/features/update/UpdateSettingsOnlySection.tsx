import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUpdateSettings, saveUpdateSettings } from "./api";
import { getUpdateErrorMessage } from "./updateErrors";
import type { UpdateSettings } from "./types";

const UPDATE_SETTINGS_SAVE_DEBOUNCE_MS = 300;

export function UpdateSettingsOnlySection({ initialSettings }: { initialSettings?: UpdateSettings }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<UpdateSettings | null>(initialSettings ?? null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettings = useRef<UpdateSettings | null>(initialSettings ?? null);

  useEffect(() => {
    if (initialSettings) return;

    let alive = true;
    void getUpdateSettings()
      .then((loadedSettings) => {
        if (!alive) return;
        pendingSettings.current = loadedSettings;
        setSettings(loadedSettings);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getUpdateErrorMessage(err, t));
      });

    return () => {
      alive = false;
    };
  }, [initialSettings, t]);

  useEffect(() => {
    return () => {
      if (saveTimer.current && pendingSettings.current) {
        clearTimeout(saveTimer.current);
        void saveUpdateSettings(pendingSettings.current).catch(() => {});
      }
    };
  }, []);

  const scheduleSave = (nextSettings: UpdateSettings) => {
    pendingSettings.current = nextSettings;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveUpdateSettings(nextSettings).catch((err) => {
        setError(getUpdateErrorMessage(err, t));
      });
    }, UPDATE_SETTINGS_SAVE_DEBOUNCE_MS);
  };

  const setConfigValue = <Key extends keyof UpdateSettings>(
    key: Key,
    value: UpdateSettings[Key],
  ) => {
    if (!settings) return;
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setError(null);
    scheduleSave(nextSettings);
  };

  return (
    <section className="space-y-2 pt-2 border-t border-paper-deep/25">
      <label className="block text-[11px] font-body text-ink-faint">
        {t("settings.update.settingsTitle", { defaultValue: "更新设置" })}
      </label>

      {settings ? (
        <div className="space-y-2">
          <ToggleRow
            label={t("settings.update.autoCheck", { defaultValue: "自动检查更新" })}
            checked={settings.autoCheck}
            onChange={(checked) => setConfigValue("autoCheck", checked)}
          />
          <ToggleRow
            label={t("settings.update.autoDownload", {
              defaultValue: "有新版本时自动下载",
            })}
            checked={settings.autoDownload}
            onChange={(checked) => setConfigValue("autoDownload", checked)}
          />
        </div>
      ) : (
        <p className="text-[11px] text-ink-ghost">
          {t("settings.update.loading", { defaultValue: "正在读取更新设置..." })}
        </p>
      )}

      {error ? <p className="text-[10px] text-red-400 leading-relaxed">{error}</p> : null}
    </section>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25 cursor-pointer">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? "bg-bamboo" : "bg-paper-deep/50"
        }`}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
