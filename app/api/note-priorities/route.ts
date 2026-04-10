import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("note-priorities")
export const POST = createCreateHandler("note-priorities")
