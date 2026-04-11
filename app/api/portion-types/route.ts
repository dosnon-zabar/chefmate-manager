import { createListHandler, createCreateHandler } from "@/lib/referential-proxy"
export const GET = createListHandler("portion-types")
export const POST = createCreateHandler("portion-types")
