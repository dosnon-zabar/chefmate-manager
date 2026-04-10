import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("note-families")
export const POST = createCreateHandler("note-families")
