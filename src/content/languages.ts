// Languages shown on the home page. `live: true` means puzzles exist in
// src/content/cinema/<code>.json. Add a language by adding a JSON file and
// flipping it to live.
export type Language = {
  code: string;
  name: string; // English name
  native: string; // Name in its own script
  live: boolean;
};

export const LANGUAGES: Language[] = [
  { code: "te", name: "Telugu", native: "తెలుగు", live: true },
  { code: "hi", name: "Hindi", native: "हिन्दी", live: true },
  { code: "ta", name: "Tamil", native: "தமிழ்", live: true },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", live: false },
  { code: "ml", name: "Malayalam", native: "മലയാളം", live: false },
  { code: "bn", name: "Bengali", native: "বাংলা", live: false },
  { code: "mr", name: "Marathi", native: "मराठी", live: false },
];

export function getLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
