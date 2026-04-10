import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("recipes")
export const POST = createCreateHandler("recipes")
