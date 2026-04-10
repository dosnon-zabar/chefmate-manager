import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("notes")
export const POST = createCreateHandler("notes")
