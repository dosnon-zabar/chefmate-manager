import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("note-families")
export const DELETE = createDeleteHandler("note-families")
