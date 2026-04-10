"use client"

import React, { useState, useMemo } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const INDENTATION_WIDTH = 24

// --- Types ---

export interface TreeItem {
  id: string
  children: TreeItem[]
  [key: string]: unknown
}

interface FlattenedItem {
  id: string
  parentId: string | null
  depth: number
  [key: string]: unknown
}

// --- Utilities ---

function flattenTree(
  items: TreeItem[],
  parentId: string | null = null,
  depth = 0
): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item) => {
    acc.push({ ...item, parentId, depth })
    if (item.children?.length) {
      acc.push(...flattenTree(item.children, item.id, depth + 1))
    }
    return acc
  }, [])
}

function removeChildrenOf(
  items: FlattenedItem[],
  activeId: string
): FlattenedItem[] {
  const activeIndex = items.findIndex((i) => i.id === activeId)
  if (activeIndex === -1) return items
  const activeDepth = items[activeIndex].depth

  const result: FlattenedItem[] = []
  let skip = false
  for (let i = 0; i < items.length; i++) {
    if (i === activeIndex) {
      result.push(items[i])
      skip = true
      continue
    }
    if (skip && items[i].depth > activeDepth) continue
    skip = false
    result.push(items[i])
  }
  return result
}

function getProjection(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  dragOffsetX: number
) {
  const activeIndex = items.findIndex((i) => i.id === activeId)
  const overIndex = items.findIndex((i) => i.id === overId)
  const activeItem = items[activeIndex]

  const newItems = arrayMove(items, activeIndex, overIndex)
  const previousItem = newItems[overIndex - 1]
  const nextItem = newItems[overIndex + 1]

  const dragDepth = Math.round(dragOffsetX / INDENTATION_WIDTH)
  const projectedDepth = activeItem.depth + dragDepth

  const maxDepth = previousItem ? previousItem.depth + 1 : 0
  const minDepth = nextItem ? nextItem.depth : 0

  const depth = Math.min(Math.max(projectedDepth, minDepth), maxDepth)

  function getParentId(): string | null {
    if (depth === 0) return null
    for (let i = overIndex - 1; i >= 0; i--) {
      if (newItems[i].depth === depth - 1) return newItems[i].id
    }
    return null
  }

  return { depth, parentId: getParentId() }
}

// --- Grip Icon (inline SVG, replaces lucide-react GripVertical) ---

function GripIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-brun-light"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

// --- Sortable Item ---

function SortableTreeItem({
  id,
  depth,
  renderItem,
}: {
  id: string
  depth: number
  renderItem: (item: { id: string; depth: number }) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-creme rounded"
        style={{ marginLeft: depth * INDENTATION_WIDTH }}
      >
        <GripIcon />
      </div>
      <div className="flex-1">{renderItem({ id, depth })}</div>
    </div>
  )
}

// --- Main Component ---

interface SortableTreeProps {
  items: TreeItem[]
  onReorder: (
    flatItems: {
      id: string
      parentId: string | null
      sort_order: number
    }[]
  ) => void
  renderItem: (item: { id: string; depth: number }) => React.ReactNode
}

export function SortableTree({
  items,
  onReorder,
  renderItem,
}: SortableTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  const flattenedItems = useMemo(() => flattenTree(items), [items])

  const displayedItems = useMemo(() => {
    if (!activeId) return flattenedItems
    return removeChildrenOf(flattenedItems, activeId)
  }, [flattenedItems, activeId])

  const projected =
    activeId && overId
      ? getProjection(displayedItems, activeId, overId, offsetLeft)
      : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    setOverId(active.id as string)
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x)
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId((over?.id as string) ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || !projected) {
      resetState()
      return
    }

    const activeIndex = displayedItems.findIndex(
      (i) => i.id === active.id
    )
    const overIndex = displayedItems.findIndex((i) => i.id === over.id)

    const newFlatItems = arrayMove(displayedItems, activeIndex, overIndex)
    const movedIndex = newFlatItems.findIndex((i) => i.id === active.id)
    newFlatItems[movedIndex] = {
      ...newFlatItems[movedIndex],
      depth: projected.depth,
      parentId: projected.parentId,
    }

    // Recalculate sort_order per parent
    const result: {
      id: string
      parentId: string | null
      sort_order: number
    }[] = []
    const orderByParent = new Map<string | null, number>()

    for (const item of newFlatItems) {
      const parentKey = item.parentId ?? null
      const sort_order = (orderByParent.get(parentKey) ?? 0) + 1
      orderByParent.set(parentKey, sort_order)
      result.push({ id: item.id, parentId: item.parentId, sort_order })
    }

    onReorder(result)
    resetState()
  }

  function resetState() {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={displayedItems.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-0.5">
          {displayedItems.map((item) => (
            <SortableTreeItem
              key={item.id}
              id={item.id}
              depth={
                item.id === activeId && projected
                  ? projected.depth
                  : item.depth
              }
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/** Convert flat items with parent_id into nested TreeItem[]. */
export function buildTreeFromFlat<
  T extends { id: string; parent_id: string | null; sort_order: number }
>(items: T[]): TreeItem[] {
  const map = new Map<string, TreeItem>()
  const roots: TreeItem[] = []

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  for (const item of sorted) {
    map.set(item.id, { ...item, children: [] })
  }

  for (const item of sorted) {
    const node = map.get(item.id)!
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
