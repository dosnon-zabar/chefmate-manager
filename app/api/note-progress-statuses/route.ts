import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("note-progress-statuses")
export const POST = createCreateHandler("note-progress-statuses")
