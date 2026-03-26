import os
import httpx


RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "onboarding@resend.dev")


class EmailService:
    @staticmethod
    def send_otp_email(to_email: str, otp_code: str, username: str) -> bool:
        if not RESEND_API_KEY:
            print(f"[DEV] OTP for {to_email}: {otp_code}")
            return True
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": FROM_EMAIL,
                    "to": [to_email],
                    "subject": "Predicto - Password Reset Code",
                    "html": f"""
                        <div style="font-family:sans-serif;max-width:400px;margin:auto">
                            <h2>Password Reset</h2>
                            <p>Hi {username}, your reset code is:</p>
                            <h1 style="letter-spacing:8px;color:#16a34a">{otp_code}</h1>
                            <p>This code expires in 10 minutes.</p>
                            <p>If you didn't request this, ignore this email.</p>
                        </div>
                    """
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Email send failed: {e}")
            return False
