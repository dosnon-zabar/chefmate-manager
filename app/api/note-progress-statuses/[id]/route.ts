import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("note-progress-statuses")
export const DELETE = createDeleteHandler("note-progress-statuses")
