import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("note-types")
export const DELETE = createDeleteHandler("note-types")
