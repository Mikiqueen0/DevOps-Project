import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session-token";

const SESSION_COOKIE = "pnl_session";

function isPublicPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/api/auth") || pathname === "/favicon.ico";
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const response = isApiPath(pathname)
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};

