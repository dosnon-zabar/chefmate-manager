import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("ingredients")
export const POST = createCreateHandler("ingredients")
