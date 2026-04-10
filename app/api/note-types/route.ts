import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("note-types")
export const POST = createCreateHandler("note-types")
