import { Settings2, Grid3x3, Lightbulb, Tag, Sun, Moon, Monitor } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import Modal, { Toggle, Segmented } from "./ui/Modal";

export default function SettingsModal({
  isOpen,
  onClose,
  theme, setTheme,
  showGrid, setShowGrid,
  showShadows, setShowShadows,
  showLabels, setShowLabels,
  sidebarPosition, setSidebarPosition,
  lang, setLang,
}) {
  const { t } = useLang();
  if (!isOpen) return null;

  const row = (label, control) => (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2">
      <span className="text-sm font-medium">{label}</span>
      {control}
    </div>
  );

  return (
    <Modal title={t("settings")} icon={Settings2} onClose={onClose} size="sm" testId="settings">
      <div className="divide-y divide-line">
        <div className="pb-3">
          {row(t("theme"), (
            <Segmented
              value={theme}
              onChange={setTheme}
              label={t("theme")}
              options={[
                { value: "system", icon: <Monitor size={14} />, label: t("themeSystem") },
                { value: "light", icon: <Sun size={14} />, label: t("themeLight") },
                { value: "dark", icon: <Moon size={14} />, label: t("themeDark") },
              ]}
            />
          ))}
          {row(t("language"), (
            <Segmented value={lang} onChange={setLang} label={t("language")} options={[{ value: "th", label: "ไทย" }, { value: "en", label: "EN" }]} />
          ))}
          {row(t("sidebarPos"), (
            <Segmented value={sidebarPosition} onChange={setSidebarPosition} label={t("sidebarPos")} options={[{ value: "left", label: t("left") }, { value: "right", label: t("right") }]} />
          ))}
        </div>
        <div className="pt-2">
          <Toggle icon={Grid3x3} label={t("grid")} checked={showGrid} onChange={setShowGrid} />
          <Toggle icon={Lightbulb} label={t("shadows")} checked={showShadows} onChange={setShowShadows} />
          <Toggle icon={Tag} label={t("faceNames")} checked={showLabels} onChange={setShowLabels} />
        </div>
      </div>
    </Modal>
  );
}
