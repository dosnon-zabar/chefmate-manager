import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export const PATCH = createUpdateHandler("seasons")
export const DELETE = createDeleteHandler("seasons")
