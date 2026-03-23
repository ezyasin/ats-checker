import { NextRequest, NextResponse } from "next/server";

const rateLimit = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 25;

function getRateLimitInfo(ip: string) {
  const now = Date.now();
  const entry = rateLimit.get(ip);

  if (!entry || now > entry.resetTime) {
    const newEntry = { count: 0, resetTime: now + WINDOW_MS };
    rateLimit.set(ip, newEntry);
    return newEntry;
  }

  return entry;
}

export function proxy(request: NextRequest) {
  // Only rate limit the analyze API
  if (!request.nextUrl.pathname.startsWith("/api/analyze")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const entry = getRateLimitInfo(ip);
  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((entry.resetTime - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
