"""Security headers middleware for FastAPI.

Adds default security headers to every response to mitigate XSS, clickjacking,
MIME-type sniffing, and protocol downgrade vulnerabilities.
Uses pure ASGI implementation to avoid Starlette BaseHTTPMiddleware deadlocks.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send


class SecurityHeadersMiddleware:
    """Pure ASGI middleware to inject standard OWASP-recommended security headers."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                # Safely extract headers as a new list to avoid mutating tuples or immutable sequences directly
                headers = list(message.get("headers", []))

                # Protect against MIME-type sniffing
                headers.append((b"x-content-type-options", b"nosniff"))

                # Protect against clickjacking
                headers.append((b"x-frame-options", b"DENY"))

                # Protect against XSS
                headers.append((b"x-xss-protection", b"0"))

                # Enforce HTTPS (HSTS)
                headers.append(
                    (
                        b"strict-transport-security",
                        b"max-age=31536000; includeSubDomains; preload",
                    )
                )

                # Control referrer information sent in request headers
                headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))

                # Content-Security-Policy (CSP) — secure default for an API service
                # Skip for documentation endpoints (/docs, /redoc, /openapi.json)
                path = scope.get("path", "")
                if not (
                    path.startswith("/docs")
                    or path.startswith("/redoc")
                    or path.startswith("/openapi.json")
                ):
                    headers.append(
                        (
                            b"content-security-policy",
                            b"default-src 'self'; frame-ancestors 'none'; sandbox",
                        )
                    )

                # Re-assign back to message
                message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_wrapper)
