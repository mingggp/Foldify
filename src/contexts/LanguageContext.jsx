import { createContext, useContext, useState, useEffect } from "react";

const translations = {
  en: {
    appTitle: "Foldify",
    uploadImage: "Upload Image",
    aiGenerator: "✨ AI Texture Generator",
    aiPlaceholder: "Make a wooden box texture, 4k...",
    aiLoading: "Generating...",
    aiGenerateBtn: "Generate with AI",
    exportImage: "Export PNG Snapshot",
    settings: "Settings",
    netGeometry: "NET GEOMETRY",
    face: "Face",
    color: "Color",
    layout: "Layout",
    addShape: "Add Shape",
    shapes: "Shapes",
    randomize: "Randomize Colors",
    saveBox: "Save Box",
    saving: "Saving...",
    myGallery: "My Gallery",
    loginRegister: "Sign In / Register",
    logout: "Logout",
    // Settings translations
    theme: "Dark Mode",
    grid: "Show Grid",
    shadows: "Show Shadows",
    language: "Language",
    sidebarPos: "Sidebar Position"
  },
  th: {
    appTitle: "Foldify",
    uploadImage: "อัปโหลดรูปภาพ",
    aiGenerator: "✨ สร้างพื้นผิวด้วย AI",
    aiPlaceholder: "สร้างลายไม้ สวยๆ 4k...",
    aiLoading: "กำลังสร้าง...",
    aiGenerateBtn: "สร้างด้วย AI",
    exportImage: "บันทึกเป็นรูปภาพ (PNG)",
    settings: "ตั้งค่า",
    netGeometry: "รูปแบบรูปคลี่ 2 มิติ",
    face: "ด้าน",
    color: "สี",
    layout: "การจัดวาง",
    addShape: "เพิ่มรูปทรง",
    shapes: "รูปทรง",
    randomize: "สุ่มสีทั้งหมด",
    saveBox: "บันทึกกล่อง",
    saving: "กำลังบันทึก...",
    myGallery: "กล่องของฉัน",
    loginRegister: "เข้าสู่ระบบ / สมัครสมาชิก",
    logout: "ออกจากระบบ",
    // Settings translations
    theme: "โหมดมืด (Dark Mode)",
    grid: "แสดงตาราง (Grid)",
    shadows: "แสดงแสงเงา (Shadow)",
    language: "ภาษา (Language)",
    sidebarPos: "ตำแหน่งแผงควบคุม"
  }
};

const LanguageContext = createContext();

export function useLang() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("appLang") || "en";
  });

  useEffect(() => {
    localStorage.setItem("appLang", lang);
  }, [lang]);

  const t = (key) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
