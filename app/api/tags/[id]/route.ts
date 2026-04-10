import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("tags")
export const DELETE = createDeleteHandler("tags")
