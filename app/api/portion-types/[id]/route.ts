import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"
export const PATCH = createUpdateHandler("portion-types")
export const DELETE = createDeleteHandler("portion-types")
