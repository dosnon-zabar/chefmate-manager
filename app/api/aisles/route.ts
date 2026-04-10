import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("aisles")
export const POST = createCreateHandler("aisles")
