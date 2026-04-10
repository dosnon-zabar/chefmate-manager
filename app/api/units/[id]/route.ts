import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("units")
export const DELETE = createDeleteHandler("units")
