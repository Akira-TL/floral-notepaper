import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addAppToBlacklist,
  addAppToWhitelist,
  getQuickNoteRules,
  removeAppFromRules,
  saveQuickNoteRules,
  type QuickNoteRules,
} from "../features/quickNoteRules/api";

const DEFAULT_RULES: QuickNoteRules = {
  suppressQuickNoteInFullscreen: false,
  appBlacklist: [],
  appWhitelist: [],
};

function normalizeRules(value: QuickNoteRules | null | undefined): QuickNoteRules {
  return {
    ...DEFAULT_RULES,
    ...value,
    suppressQuickNoteInFullscreen: Boolean(value?.suppressQuickNoteInFullscreen),
    appBlacklist: Array.isArray(value?.appBlacklist) ? value.appBlacklist : [],
    appWhitelist: Array.isArray(value?.appWhitelist) ? value.appWhitelist : [],
  };
}

export function QuickNoteRulesSection() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<QuickNoteRules>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules(normalizeRules(await getQuickNoteRules()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (nextRules: QuickNoteRules) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveQuickNoteRules(normalizeRules(nextRules));
      setRules(normalizeRules(saved));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <section className="space-y-2">
      <label className="block text-[11px] font-body text-ink-faint">
        {t("settings.quickNoteRules.title", { defaultValue: "快速记录响应规则" })}
      </label>

      <ToggleRow
        label={t("settings.quickNoteRules.suppressFullscreen", {
          defaultValue: "全屏应用中禁用快速记录",
        })}
        checked={rules.suppressQuickNoteInFullscreen}
        disabled={disabled}
        onChange={(checked) => void persist({ ...rules, suppressQuickNoteInFullscreen: checked })}
      />

      <RuleList
        title={t("settings.quickNoteRules.whitelist", { defaultValue: "允许快速记录的应用" })}
        addLabel={t("settings.quickNoteRules.add", { defaultValue: "点击添加" })}
        placeholder={t("settings.quickNoteRules.manualPlaceholder", {
          defaultValue: "输入应用程序名，例如 cs2.exe",
        })}
        submitTitle={t("settings.quickNoteRules.submitAdd", { defaultValue: "添加" })}
        removeLabel={t("common.remove", { defaultValue: "移除" })}
        apps={rules.appWhitelist}
        disabled={disabled}
        onAdd={(exeName) => void persist(addAppToWhitelist(rules, exeName))}
        onRemove={(exeName) => void persist(removeAppFromRules(rules, exeName))}
      />
      <RuleList
        title={t("settings.quickNoteRules.blacklist", { defaultValue: "排除快速记录的应用" })}
        addLabel={t("settings.quickNoteRules.add", { defaultValue: "点击添加" })}
        placeholder={t("settings.quickNoteRules.manualPlaceholder", {
          defaultValue: "输入应用程序名，例如 cs2.exe",
        })}
        submitTitle={t("settings.quickNoteRules.submitAdd", { defaultValue: "添加" })}
        removeLabel={t("common.remove", { defaultValue: "移除" })}
        apps={rules.appBlacklist}
        disabled={disabled}
        onAdd={(exeName) => void persist(addAppToBlacklist(rules, exeName))}
        onRemove={(exeName) => void persist(removeAppFromRules(rules, exeName))}
      />

      {error && <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>}
    </section>
  );
}

function normalizeExeName(value: string): string {
  return value.trim().split(/[\\/]/).pop()?.trim().toLowerCase() ?? "";
}

function RuleList({
  title,
  addLabel,
  placeholder,
  submitTitle,
  removeLabel,
  apps,
  disabled,
  onAdd,
  onRemove,
}: {
  title: string;
  addLabel: string;
  placeholder: string;
  submitTitle: string;
  removeLabel: string;
  apps: string[];
  disabled: boolean;
  onAdd: (exeName: string) => void;
  onRemove: (exeName: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const normalizedDraft = useMemo(() => normalizeExeName(draft), [draft]);
  const canSubmit = normalizedDraft.length > 0 && !disabled;

  const resetAdding = () => {
    setDraft("");
    setAdding(false);
  };

  const submit = () => {
    if (!canSubmit) return;
    onAdd(normalizedDraft);
    resetAdding();
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-ink-faint/80 px-0.5">{title}</div>
      <div className="rounded-xl border border-paper-deep/25 bg-paper-warm/25 divide-y divide-paper-deep/20 overflow-hidden">
        {apps.map((exeName) => (
          <div
            key={exeName}
            className="flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-cloud/35"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-soft">
              {exeName}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(exeName)}
              className="h-6 px-2 rounded-md text-[10px] text-ink-ghost hover:text-red-400 hover:bg-red-400/10 disabled:opacity-45 transition-colors cursor-pointer"
            >
              {removeLabel}
            </button>
          </div>
        ))}

        {adding ? (
          <div
            className="flex h-9 items-center gap-2 px-3 bg-bamboo-mist/25 transition-colors"
            onBlur={(event) => {
              const nextFocused = event.relatedTarget;
              if (nextFocused && event.currentTarget.contains(nextFocused as Node)) {
                return;
              }
              if (!normalizedDraft) {
                resetAdding();
              }
            }}
          >
            <input
              type="text"
              value={draft}
              autoFocus
              disabled={disabled}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                } else if (event.key === "Escape") {
                  resetAdding();
                }
              }}
              placeholder={placeholder}
              spellCheck={false}
              className="min-w-0 flex-1 h-full p-0 bg-transparent border-0 text-[10px] font-mono text-ink-soft outline-none placeholder:text-ink-ghost/70 disabled:opacity-50"
            />
            <button
              type="button"
              title={submitTitle}
              aria-label={submitTitle}
              disabled={!canSubmit}
              onMouseDown={(event) => event.preventDefault()}
              onClick={submit}
              className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg text-bamboo hover:bg-cloud/60 active:scale-95 disabled:opacity-45 disabled:active:scale-100 transition cursor-pointer"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8.5l3 3L13 4" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAdding(true)}
            className="flex h-9 w-full items-center px-3 text-left text-[10px] text-ink-ghost transition-colors hover:bg-bamboo-mist/45 hover:text-bamboo active:bg-bamboo-mist/70 disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-ghost cursor-pointer"
          >
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <span className="text-[12px] text-ink-soft">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
