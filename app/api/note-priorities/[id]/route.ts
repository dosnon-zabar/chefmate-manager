import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("note-priorities")
export const DELETE = createDeleteHandler("note-priorities")
