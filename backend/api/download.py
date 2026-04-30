from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

APP_STORE_URL = "https://apps.apple.com/app/id6761910465"
PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.predictoapp.football"


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
