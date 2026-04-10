import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("notes")
export const DELETE = createDeleteHandler("notes")
