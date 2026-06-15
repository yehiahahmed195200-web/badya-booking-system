import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("language") || "en";
  });

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ar" : "en"));
  };

  useEffect(() => {
    localStorage.setItem("language", language);
    // Apply layout direction dynamically
    if (language === "ar") {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", "ar");
      document.body.classList.add("rtl-mode");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "en");
      document.body.classList.remove("rtl-mode");
    }
  }, [language]);

  // Translate function using dot notation path lookup
  const t = (keyPath, replacements = {}) => {
    const dict = translations[language] || translations["en"];
    const keys = keyPath.split(".");
    let val = dict;
    for (const k of keys) {
      if (val && typeof val === "object") {
        val = val[k];
      } else {
        val = undefined;
        break;
      }
    }
    if (val === undefined) {
      // Fallback to English dictionary just in case
      const engDict = translations["en"];
      let engVal = engDict;
      for (const k of keys) {
        if (engVal && typeof engVal === "object") {
          engVal = engVal[k];
        } else {
          engVal = undefined;
          break;
        }
      }
      if (engVal !== undefined) {
        val = engVal;
      } else {
        return keyPath; // fallback to path itself
      }
    }

    let text = String(val);
    Object.keys(replacements).forEach((k) => {
      text = text.replace(`{${k}}`, replacements[k]);
    });
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
