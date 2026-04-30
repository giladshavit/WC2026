import json
from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from urllib.parse import quote

router = APIRouter()

APP_STORE_URL = "https://apps.apple.com/app/id6761910465"
PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.predictoapp.football"
APP_SCHEME = "predicto://join"


@router.get("/download", response_class=HTMLResponse)
async def download_redirect():
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Download Predicto</title>
    </head>
    <body>
        <script>
            const ua = navigator.userAgent.toLowerCase();
            if (/iphone|ipad|ipod/.test(ua)) {{
                window.location.href = "{APP_STORE_URL}";
            }} else if (/android/.test(ua)) {{
                window.location.href = "{PLAY_STORE_URL}";
            }} else {{
                document.write(
                    '<h2>Download Predicto</h2>' +
                    '<p><a href="{APP_STORE_URL}">📱 Download on App Store (iOS)</a></p>' +
                    '<p><a href="{PLAY_STORE_URL}">🤖 Download on Google Play (Android)</a></p>'
                );
            }}
        </script>
        <noscript>
            <h2>Download Predicto</h2>
            <p><a href="{APP_STORE_URL}">📱 App Store (iOS)</a></p>
            <p><a href="{PLAY_STORE_URL}">🤖 Google Play (Android)</a></p>
        </noscript>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@router.get("/join", response_class=HTMLResponse)
async def join_redirect(code: str = ""):
    deep_link = f"{APP_SCHEME}?code={quote(code.upper(), safe='')}"
    code_display = escape(code.upper())
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Join Predicto League</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                background: #0f172a;
                color: #f1f5f9;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 24px;
                box-sizing: border-box;
                text-align: center;
            }}
            h2 {{ color: #ffffff; margin-bottom: 8px; }}
            p {{ color: #94a3b8; margin-bottom: 24px; }}
            .code {{
                font-size: 28px;
                font-weight: bold;
                letter-spacing: 6px;
                color: #60a5fa;
                background: #1e3a5f;
                padding: 16px 32px;
                border-radius: 12px;
                margin-bottom: 32px;
                font-family: monospace;
            }}
            .btn {{
                display: inline-block;
                padding: 14px 32px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                text-decoration: none;
                color: white;
                background: #2563eb;
                margin-bottom: 12px;
            }}
        </style>
    </head>
    <body>
        <h2>🏆 Join Predicto League</h2>
        <p>You've been invited to join a league!</p>
        <div class="code">{code_display}</div>
        <script>
            const deepLink = {json.dumps(deep_link)};
            const ua = navigator.userAgent.toLowerCase();
            const isIOS = /iphone|ipad|ipod/.test(ua);
            const isAndroid = /android/.test(ua);
            const storeUrl = isIOS
                ? "{APP_STORE_URL}"
                : "{PLAY_STORE_URL}";

            // Try to open app
            window.location.href = deepLink;

            // If app not installed, redirect to store after timeout
            setTimeout(() => {{
                if (isIOS || isAndroid) {{
                    window.location.href = storeUrl;
                }}
            }}, 2500);
        </script>
        <!-- Fallback for desktop -->
        <noscript>
            <a class="btn" href="{APP_STORE_URL}">📱 App Store (iOS)</a>
            <a class="btn" href="{PLAY_STORE_URL}">🤖 Google Play (Android)</a>
        </noscript>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
