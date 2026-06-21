import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 不需要认证的路径
const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径直接放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 检查是否有 token（通过 cookie 或 query param 传递）
  // 注意：middleware 运行在 Edge Runtime，无法访问 localStorage
  // 我们依赖客户端的 AuthContext 进行实际验证
  // 这里只做基本的路由保护提示
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
