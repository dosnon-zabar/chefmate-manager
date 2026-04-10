import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("aisles")
export const DELETE = createDeleteHandler("aisles")
