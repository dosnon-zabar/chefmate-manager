import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("tags")
export const POST = createCreateHandler("tags")
