// Runs before the admin page and its API are rendered (Next.js Proxy, the
// former middleware): asks for the admin password with HTTP Basic auth and
// keeps search engines and caches away. Every other path is untouched.
import { NextResponse, type NextRequest } from "next/server";
import { adminAuthorized } from "@/admin-auth";

const PRIVATE = { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" };

export function proxy(request: NextRequest): NextResponse {
  if (adminAuthorized(request.headers.get("authorization"), process.env.ADMIN_PASSWORD)) {
    return NextResponse.next({ headers: PRIVATE });
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { ...PRIVATE, "www-authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
