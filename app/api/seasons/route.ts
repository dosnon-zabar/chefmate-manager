import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"

export const GET = createListHandler("seasons")
export const POST = createCreateHandler("seasons")
