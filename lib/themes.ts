export interface ThemeDefinition {
  id: string
  name: string
  /** Small preview colors shown in the selector: [accent, bg, sidebar] */
  preview: [string, string, string]
  vars: Record<string, string>
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "sauge-terracotta",
    name: "Sauge & Terracotta",
    preview: ["#D4764E", "#F2F5F0", "#2D3B2D"],
    vars: {
      "--color-orange": "#D4764E",
      "--color-orange-light": "#E8A07A",
      "--color-jaune": "#E8C864",
      "--color-jaune-light": "#F5E4A8",
      "--color-peche": "#E8B4A0",
      "--color-peche-light": "#F5DDD0",
      "--color-rose": "#D46B6B",
      "--color-vert-eau": "#8BB89A",
      "--color-vert-eau-light": "#D8E8D4",
      "--color-bleu-gris": "#8B9DAF",
      "--color-bleu-gris-light": "#B8C5D3",
      "--color-creme": "#F2F5F0",
      "--color-creme-dark": "#E4E9E0",
      "--color-brun": "#2D3B2D",
      "--color-brun-light": "#6B7B6B",
    },
  },
  {
    id: "original",
    name: "Original",
    preview: ["#E8792B", "#F6F1EA", "#3D3229"],
    vars: {
      "--color-orange": "#E8792B",
      "--color-orange-light": "#F4A261",
      "--color-jaune": "#F2C94C",
      "--color-jaune-light": "#FBE8A6",
      "--color-peche": "#E8B4A0",
      "--color-peche-light": "#F3D5C8",
      "--color-rose": "#E87FA0",
      "--color-vert-eau": "#8EC8B0",
      "--color-vert-eau-light": "#C3E5D7",
      "--color-bleu-gris": "#8B9DAF",
      "--color-bleu-gris-light": "#B8C5D3",
      "--color-creme": "#F6F1EA",
      "--color-creme-dark": "#EDE5D8",
      "--color-brun": "#3D3229",
      "--color-brun-light": "#6B5E52",
    },
  },
  {
    id: "lavande-peche",
    name: "Lavande & Pêche",
    preview: ["#E8846A", "#F5F0FA", "#3D2E5C"],
    vars: {
      "--color-orange": "#E8846A",
      "--color-orange-light": "#F2A894",
      "--color-jaune": "#F0D264",
      "--color-jaune-light": "#F8EBB0",
      "--color-peche": "#F2A894",
      "--color-peche-light": "#F9DDD4",
      "--color-rose": "#E87FA0",
      "--color-vert-eau": "#7DC4A5",
      "--color-vert-eau-light": "#D4E8DC",
      "--color-bleu-gris": "#9B8EBB",
      "--color-bleu-gris-light": "#C4BAD8",
      "--color-creme": "#F5F0FA",
      "--color-creme-dark": "#E8E0F2",
      "--color-brun": "#3D2E5C",
      "--color-brun-light": "#7B6E8E",
    },
  },
  {
    id: "ciel-abricot",
    name: "Ciel & Abricot",
    preview: ["#E8924B", "#F0F4F8", "#2A3A4A"],
    vars: {
      "--color-orange": "#E8924B",
      "--color-orange-light": "#F4B87A",
      "--color-jaune": "#F0D264",
      "--color-jaune-light": "#F8ECB4",
      "--color-peche": "#F0C4A0",
      "--color-peche-light": "#FBE0CC",
      "--color-rose": "#E87F7F",
      "--color-vert-eau": "#7BC4B8",
      "--color-vert-eau-light": "#D4EAE6",
      "--color-bleu-gris": "#8B9DAF",
      "--color-bleu-gris-light": "#B8C5D3",
      "--color-creme": "#F0F4F8",
      "--color-creme-dark": "#DFE6EE",
      "--color-brun": "#2A3A4A",
      "--color-brun-light": "#6B7B8B",
    },
  },
  {
    id: "nuit",
    name: "Nuit",
    preview: ["#E8924B", "#1A1A2E", "#12121E"],
    vars: {
      "--color-orange": "#E8924B",
      "--color-orange-light": "#F4B87A",
      "--color-jaune": "#F0D264",
      "--color-jaune-light": "#4A4530",
      "--color-peche": "#B0856E",
      "--color-peche-light": "#3D2E28",
      "--color-rose": "#E87F7F",
      "--color-vert-eau": "#5DAA96",
      "--color-vert-eau-light": "#1E3A32",
      "--color-bleu-gris": "#6B7D94",
      "--color-bleu-gris-light": "#2A3444",
      "--color-creme": "#1A1A2E",
      "--color-creme-dark": "#14142A",
      "--color-brun": "#E8E4E0",
      "--color-brun-light": "#A09890",
    },
  },
]

export const DEFAULT_THEME_ID = "original"

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
