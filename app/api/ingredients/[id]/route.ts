import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("ingredients")
export const DELETE = createDeleteHandler("ingredients")
