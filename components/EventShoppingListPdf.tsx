"use client"

import { jsPDF } from "jspdf"
import { formatIngredientNatural } from "@/lib/format-ingredient"

interface ShoppingItem {
  name: string
  quantity: number
  unit: string
  unitPlural?: string | null
  sources: string[]
}

interface AisleGroup {
  id: string
  name: string
  color: string
  items: ShoppingItem[]
}

interface FamilyGroup {
  id: string | null
  name: string
  color: string
  aisles: AisleGroup[]
}

interface Props {
  eventName: string
  organized: FamilyGroup[]
  guestCount: number
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ]
}

/** Convert SVG URL to PNG data URL via canvas */
async function svgToPngDataUrl(svgUrl: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("No canvas")); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = reject
    img.src = svgUrl
  })
}

export async function generateShoppingListPdf({ eventName, organized, guestCount }: Props) {
  const doc = new jsPDF("p", "mm", "a4")
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const subMargin = margin + 4 // retrait sous-rayons
  const contentWidth = pageWidth - margin * 2
  const subContentWidth = contentWidth - 4 // largeur sous-rayons (en retrait)
  let y = margin
  let pageNum = 1

  // Pre-load logo for footer
  let logoPng: string | null = null
  try {
    logoPng = await svgToPngDataUrl("/chefmate-logo.svg", 565, 133)
  } catch { /* logo non disponible */ }

  function addFooter() {
    doc.setFontSize(8)
    doc.setTextColor(180, 180, 180)
    doc.setFont("helvetica", "normal")
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    doc.text(dateStr, margin, pageHeight - 8)
    doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: "right" })
    // Logo centré dans le footer
    if (logoPng) {
      const logoW = 28
      const logoH = 6.6
      doc.addImage(logoPng, "PNG", (pageWidth - logoW) / 2, pageHeight - 10, logoW, logoH)
    }
  }

  function newPage() {
    addFooter()
    doc.addPage()
    pageNum++
    y = margin
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 15) newPage()
  }

  // === HEADER ===
  // Event name as main title
  doc.setFontSize(20)
  doc.setTextColor(51, 51, 51)
  doc.setFont("helvetica", "bold")
  doc.text(eventName, margin, y)
  y += 8

  // "Liste de courses" + guest count
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120, 120, 120)
  const subtitle = guestCount > 0 ? `Liste de courses — ${guestCount} convives` : "Liste de courses"
  doc.text(subtitle, margin, y)
  y += 8

  // Line separator
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // === FAMILIES & AISLES ===
  const rightEdge = margin + contentWidth // all blocks align to this right edge

  for (const family of organized) {
    // Ensure family bar is NEVER alone at bottom of page:
    // Need space for bar (14mm) + first sub-aisle fully
    const remainingOnPage = pageHeight - 15 - y
    const firstAisle = family.aisles[0]
    const firstAisleItemCount = firstAisle ? Math.ceil(firstAisle.items.length / 2) : 0 // rows (2 cols)
    const firstAisleHeight = firstAisleItemCount * 10 + 16 // rows + header + padding
    if (remainingOnPage < 14 + firstAisleHeight) {
      newPage()
    }

    // Family header — colored bar full width
    const rgb = hexToRgb(family.color)
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.roundedRect(margin, y - 4, contentWidth, 8, 1.5, 1.5, "F")
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    doc.text(family.name.toUpperCase(), margin + 4, y + 1)
    y += 10

    for (let aisleIdx = 0; aisleIdx < family.aisles.length; aisleIdx++) {
      const aisle = family.aisles[aisleIdx]
      const showSubHeader = aisle.name !== family.name || family.aisles.length > 1

      // Retrait à gauche pour sous-rayons, aligné à droite avec le bloc rayon
      const blockMargin = showSubHeader ? subMargin : margin
      const blockWidth = rightEdge - blockMargin // aligne à droite avec le rayon
      const colGap = 6
      const colWidth = (blockWidth - colGap) / 2

      // Items in 2 columns
      const leftItems = aisle.items.filter((_, i) => i % 2 === 0)
      const rightItems = aisle.items.filter((_, i) => i % 2 === 1)
      const maxRows = Math.max(leftItems.length, rightItems.length)

      // Measure row heights
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const rowHeights: number[] = []
      for (let row = 0; row < maxRows; row++) {
        const leftH = leftItems[row] ? measureItemHeight(doc, leftItems[row], colWidth) : 0
        const rightH = rightItems[row] ? measureItemHeight(doc, rightItems[row], colWidth) : 0
        rowHeights.push(Math.max(leftH, rightH))
      }

      const itemsHeight = rowHeights.reduce((s, h) => s + h, 0)
      const headerHeight = showSubHeader ? 8 : 0
      const totalBlockHeight = headerHeight + itemsHeight + 4

      checkPageBreak(totalBlockHeight)

      // Background for sub-aisle block (parent color at ~12%)
      if (showSubHeader) {
        const bgRgb = hexToRgb(family.color)
        doc.setFillColor(
          Math.round(255 - (255 - bgRgb[0]) * 0.12),
          Math.round(255 - (255 - bgRgb[1]) * 0.12),
          Math.round(255 - (255 - bgRgb[2]) * 0.12)
        )
        doc.roundedRect(blockMargin - 2, y - 2, blockWidth + 2, totalBlockHeight, 1.5, 1.5, "F")

        // Sub-header
        const aisleRgb = hexToRgb(aisle.color)
        doc.setFillColor(aisleRgb[0], aisleRgb[1], aisleRgb[2])
        doc.circle(blockMargin + 2, y + 1, 1.5, "F")
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(80, 80, 80)
        doc.text(aisle.name, blockMargin + 6, y + 2)
        y += headerHeight
      }

      // Render items
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")

      for (let row = 0; row < maxRows; row++) {
        checkPageBreak(rowHeights[row])

        if (leftItems[row]) {
          renderItem(doc, leftItems[row], blockMargin, y, colWidth)
        }
        if (rightItems[row]) {
          renderItem(doc, rightItems[row], blockMargin + colWidth + colGap, y, colWidth)
        }

        y += rowHeights[row]
      }

      y += 3 // padding inside block

      // Gap between sub-aisles (no background)
      if (aisleIdx < family.aisles.length - 1) {
        y += 4
      }
    }

    y += 5 // gap after family
  }

  addFooter()
  doc.save(`liste-courses-${eventName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`)
}

function measureItemHeight(doc: jsPDF, item: ShoppingItem, maxWidth: number): number {
  const baseHeight = 4
  if (item.sources.length === 0) return baseHeight + 3
  doc.setFontSize(7)
  const sourcesText = item.sources.join(", ")
  const sourceLines = doc.splitTextToSize(sourcesText, maxWidth)
  doc.setFontSize(9)
  return baseHeight + sourceLines.length * 3 + 2
}

function renderItem(doc: jsPDF, item: ShoppingItem, x: number, y: number, maxWidth: number) {
  // Format using natural French rules (pcs hidden, de/d', plurals)
  const formatted = formatIngredientNatural(item.name, item.quantity, item.unit, item.unitPlural)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(51, 51, 51)
  doc.setFontSize(9)
  const textLine = doc.splitTextToSize(formatted, maxWidth)[0] || formatted
  doc.text(textLine, x, y)

  // Sources (below, smaller, gray — multi-line)
  if (item.sources.length > 0) {
    doc.setFontSize(7)
    doc.setTextColor(170, 170, 170)
    const sourcesText = item.sources.join(", ")
    const sourceLines: string[] = doc.splitTextToSize(sourcesText, maxWidth)
    for (let i = 0; i < sourceLines.length; i++) {
      doc.text(sourceLines[i], x, y + 3.5 + i * 3)
    }
    doc.setFontSize(9)
  }
}
