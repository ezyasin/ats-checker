import { NextResponse } from "next/server";
import { getAvailableProviders, getDefaultProvider } from "@/lib/llm/factory";

export async function GET() {
  return NextResponse.json({
    available: getAvailableProviders(),
    default: getDefaultProvider(),
  });
}
