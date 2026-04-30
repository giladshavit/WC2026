from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

TEAM_ID = "6K92H5SG5N"
BUNDLE_ID = "com.predictoapp.football"
SHA256_FINGERPRINT = "A2:6A:12:0B:FB:46:13:FA:FE:52:0C:90:0B:F0:24:99:84:7F:AC:29:69:C2:23:CF:F8:15:A7:A8:2A:0A:57:4D"


@router.get("/.well-known/apple-app-site-association")
async def apple_app_site_association():
    return JSONResponse(
        content={
            "applinks": {
                "apps": [],
                "details": [
                    {
                        "appIDs": [f"{TEAM_ID}.{BUNDLE_ID}"],
                        "components": [
                            {
                                "/": "/join*",
                                "comment": "Matches any URL whose path starts with /join",
                            },
                            {
                                "/": "/download*",
                                "comment": "Matches download page",
                            },
                        ],
                    }
                ],
            }
        },
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
        },
    )


@router.get("/.well-known/assetlinks.json")
async def asset_links():
    return JSONResponse(
        content=[
            {
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {
                    "namespace": "android_app",
                    "package_name": BUNDLE_ID,
                    "sha256_cert_fingerprints": [SHA256_FINGERPRINT],
                },
            }
        ],
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
        },
    )
