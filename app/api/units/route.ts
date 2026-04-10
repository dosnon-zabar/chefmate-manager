import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("units")
export const POST = createCreateHandler("units")
