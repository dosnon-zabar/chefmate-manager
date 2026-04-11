"use client"

import { useState } from "react"
import { jsPDF } from "jspdf"

interface Ingredient {
  name: string
  quantity: number | null
  unit?: { abbreviation: string } | null
  aisle?: { name: string; color: string } | null
  comment?: string | null
}

interface Step {
  sort_order: number
  title: string | null
  text: string
}

interface RecipeForPdf {
  name: string
  serving_count: number
  ingredients: Ingredient[]
  recipe_steps: Step[]
}

interface Props {
  open: boolean
  onClose: () => void
  recipe: RecipeForPdf
}

const PIECE_UNITS = ["pcs", "pièce", "pièces", "piece", "u"]
const PLURALIZABLE_UNITS = [
  "gousse",
  "tête",
  "tranche",
  "feuille",
  "botte",
  "branche",
  "brin",
]

function formatIngredient(
  name: string,
  quantity: number,
  unitAbbrev: string | null | undefined
): string {
  const n = name.toLowerCase()
  const isPiece =
    !unitAbbrev || PIECE_UNITS.includes(unitAbbrev.toLowerCase())

  if (isPiece) {
    const displayName =
      quantity >= 2 &&
      !n.endsWith("s") &&
      !n.endsWith("x") &&
      !n.endsWith("z")
        ? n + "s"
        : n
    return `${quantity} ${displayName}`
  }

  const unitLower = (unitAbbrev || "").toLowerCase()
  let displayUnit = unitAbbrev || ""
  if (quantity >= 2 && PLURALIZABLE_UNITS.includes(unitLower)) {
    displayUnit = displayUnit + "s"
  }

  const startsWithVowel = /^[aeiouyàâäéèêëïîôùûüœæh]/i.test(n)
  const liaison = startsWithVowel ? "d'" : "de "

  return `${quantity} ${displayUnit} ${liaison}${n}`
}

function parseHtmlToText(html: string): string {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function roundQty(qty: number): number {
  if (qty === Math.floor(qty)) return qty
  return Math.round(qty * 100) / 100
}

export default function RecipePdfModal({ open, onClose, recipe }: Props) {
  const [portions, setPortions] = useState(recipe.serving_count || 1)

  if (!open) return null

  const multiplier = portions / (recipe.serving_count || 1)

  const scaledIngredients = recipe.ingredients.map((ing) => ({
    ...ing,
    scaledQty: ing.quantity ? roundQty(ing.quantity * multiplier) : null,
  }))

  function generatePdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    const pageWidth = 210
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let y = 20

    function addFooter(pageNum: number, totalPages: number) {
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
        margin,
        290
      )
      doc.text(`${pageNum} / ${totalPages}`, pageWidth - margin, 290, {
        align: "right",
      })
    }

    function checkPageBreak(needed: number) {
      if (y + needed > 270) {
        doc.addPage()
        y = 20
      }
    }

    // === HEADER ===
    doc.setFontSize(22)
    doc.setTextColor(51, 51, 51)
    doc.setFont("helvetica", "bold")
    const titleLines = doc.splitTextToSize(recipe.name, contentWidth)
    doc.text(titleLines, margin, y)
    y += titleLines.length * 8 + 4

    // Portions
    doc.setFontSize(11)
    doc.setTextColor(120, 120, 120)
    doc.setFont("helvetica", "normal")
    doc.text(`Pour ${portions} ${portions > 1 ? "personnes" : "personne"}`, margin, y)
    if (multiplier !== 1) {
      doc.text(
        `(adapté depuis ${recipe.serving_count} ${recipe.serving_count > 1 ? "personnes" : "personne"})`,
        margin + 50,
        y
      )
    }
    y += 10

    // === INGRÉDIENTS ===
    doc.setFontSize(14)
    doc.setTextColor(51, 51, 51)
    doc.setFont("helvetica", "bold")
    doc.text("INGRÉDIENTS", margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")

    for (const ing of scaledIngredients) {
      checkPageBreak(6)

      // Colored bullet
      const color = ing.aisle?.color || "#999999"
      const rgb = hexToRgb(color)
      doc.setFillColor(rgb[0], rgb[1], rgb[2])
      doc.circle(margin + 2, y - 1.2, 1.5, "F")

      const text = ing.scaledQty !== null
        ? formatIngredient(ing.name, ing.scaledQty, ing.unit?.abbreviation)
        : ing.name.toLowerCase()

      const commentText = ing.comment ? ` (${ing.comment})` : ""

      doc.setTextColor(51, 51, 51)
      doc.text(`  ${text}${commentText}`, margin + 5, y)
      y += 5.5
    }

    y += 6

    // === ÉTAPES ===
    if (recipe.recipe_steps.length > 0) {
      checkPageBreak(15)
      doc.setFontSize(14)
      doc.setTextColor(51, 51, 51)
      doc.setFont("helvetica", "bold")
      doc.text("PRÉPARATION", margin, y)
      y += 8

      const sorted = [...recipe.recipe_steps].sort(
        (a, b) => a.sort_order - b.sort_order
      )

      for (let i = 0; i < sorted.length; i++) {
        const step = sorted[i]
        checkPageBreak(15)

        // Step number
        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(232, 121, 43) // orange
        const stepTitle = step.title
          ? `Étape ${i + 1} — ${step.title}`
          : `Étape ${i + 1}`
        doc.text(stepTitle, margin, y)
        y += 6

        // Step text
        const plainText = parseHtmlToText(step.text)
        if (plainText) {
          doc.setFontSize(10)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(80, 80, 80)
          const lines = doc.splitTextToSize(plainText, contentWidth)
          for (const line of lines) {
            checkPageBreak(5)
            doc.text(line, margin, y)
            y += 4.5
          }
        }
        y += 4
      }
    }

    // Footers
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      addFooter(i, totalPages)
    }

    // Download
    const safeName = recipe.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
    doc.save(`recette-${safeName}-${portions}p.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-brun/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 animate-slide-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-brun">
            Télécharger le PDF
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-brun-light hover:text-brun"
          >
            ✕
          </button>
        </div>

        {/* Portions adjuster */}
        <div className="bg-creme rounded-lg p-4 mb-4">
          <label className="block text-sm font-medium text-brun mb-2">
            Adapter les quantités pour
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPortions((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-full bg-white border border-brun/10 text-brun flex items-center justify-center hover:bg-creme-dark transition-colors"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={portions}
              onChange={(e) =>
                setPortions(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-16 text-center text-lg font-semibold text-brun bg-white border border-brun/10 rounded-lg px-2 py-1"
            />
            <button
              type="button"
              onClick={() => setPortions((p) => p + 1)}
              className="w-8 h-8 rounded-full bg-white border border-brun/10 text-brun flex items-center justify-center hover:bg-creme-dark transition-colors"
            >
              +
            </button>
            <span className="text-sm text-brun-light">
              {portions > 1 ? "personnes" : "personne"}
            </span>
            {multiplier !== 1 && (
              <span className="text-xs text-orange ml-auto">
                ×{roundQty(multiplier)}
              </span>
            )}
          </div>
        </div>

        {/* Preview of scaled ingredients */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">
            Aperçu des ingrédients
          </h4>
          <ul className="space-y-1">
            {scaledIngredients
              .filter((i) => i.name.trim())
              .map((ing, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-brun"
                >
                  {ing.aisle?.color && (
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: ing.aisle.color }}
                    />
                  )}
                  <span>
                    {ing.scaledQty !== null
                      ? formatIngredient(
                          ing.name,
                          ing.scaledQty,
                          ing.unit?.abbreviation
                        )
                      : ing.name.toLowerCase()}
                    {ing.comment && (
                      <span className="text-brun-light italic ml-1">
                        ({ing.comment})
                      </span>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={() => {
            generatePdf()
            onClose()
          }}
          className="w-full py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
        >
          Télécharger le PDF
        </button>
      </div>
    </div>
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ]
}
