import { createContext, useContext, useState, useEffect } from "react";

const translations = {
  en: {
    appTitle: "Foldify",
    uploadImage: "Upload Image",
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
    sidebarPos: "Sidebar Position",
    // Share / QR
    share: "Share / QR",
    shareTitle: "Share link & QR code",
    shareHint: "Type a label on each square (letters, numbers or Thai). Pictures and shapes are not included in the link — save the box and share it from My Gallery for that.",
    shareTurn: "Turn label 90°",
    shareStartFolded: "Open folded",
    shareStartQuiz: "Open in guess mode",
    shareApply: "Use these labels on the box",
    shareCopy: "Copy link",
    shareCopied: "Link copied",
    shareDownloadQr: "Download QR (PNG)",
    shareBoxPublic: "Anyone with this link can open this box",
    shareMakePrivate: "Stop sharing",
    shareMakePublic: "Share this box",
    // Quiz
    quiz: "Guess before folding",
    quizQuestion: "Which face is opposite",
    quizCorrect: "Correct!",
    quizWrong: "Not quite — the answer is",
    quizNext: "Another face",
    quizNewNet: "New net",
    quizClose: "Close",
    quizScore: "Score",
    quizNoLabels: "This net has no labels, so here is a practice net with letters A–F. Your design comes back when you close the quiz.",
    boxLinkFailed: "This box can't be opened (it may be private or deleted).",
  },
  th: {
    appTitle: "Foldify",
    uploadImage: "อัปโหลดรูปภาพ",
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
    sidebarPos: "ตำแหน่งแผงควบคุม",
    // Share / QR
    share: "แชร์ / QR",
    shareTitle: "ลิงก์และ QR สำหรับชีท",
    shareHint: "พิมพ์ตัวอักษรลงแต่ละช่อง (อังกฤษ ตัวเลข หรือไทย) รูปภาพและรูปทรงจะไม่ไปกับลิงก์ — ถ้าต้องการ ให้บันทึกกล่องแล้วแชร์จาก \"กล่องของฉัน\"",
    shareTurn: "หมุนตัวอักษร 90°",
    shareStartFolded: "เปิดมาแบบพับแล้ว",
    shareStartQuiz: "เปิดมาเป็นโหมดทาย",
    shareApply: "ใช้ตัวอักษรนี้กับกล่อง",
    shareCopy: "คัดลอกลิงก์",
    shareCopied: "คัดลอกลิงก์แล้ว",
    shareDownloadQr: "ดาวน์โหลด QR (PNG)",
    shareBoxPublic: "ใครมีลิงก์นี้ก็เปิดกล่องนี้ได้",
    shareMakePrivate: "เลิกแชร์",
    shareMakePublic: "แชร์กล่องนี้",
    // Quiz
    quiz: "ทายก่อนพับ",
    quizQuestion: "หน้าไหนอยู่ตรงข้ามกับ",
    quizCorrect: "ถูกต้อง!",
    quizWrong: "ยังไม่ใช่ — คำตอบคือ",
    quizNext: "ถามหน้าอื่น",
    quizNewNet: "สุ่มรูปคลี่ใหม่",
    quizClose: "ปิด",
    quizScore: "คะแนน",
    quizNoLabels: "รูปคลี่นี้ยังไม่มีตัวอักษร เลยสุ่มรูปคลี่ฝึกที่มี A–F ให้ ปิดโหมดทายแล้วงานเดิมจะกลับมา",
    boxLinkFailed: "เปิดกล่องนี้ไม่ได้ (อาจเป็นกล่องส่วนตัวหรือถูกลบไปแล้ว)",
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
