import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import logging
from config import settings
from typing import Optional, List, Dict
import io

logger = logging.getLogger(__name__)


async def send_email(
    to: str,
    subject: str,
    body: str,
    attachment_bytes: Optional[bytes] = None,
    attachment_name: Optional[str] = None,
):
    if not settings.email_user or not settings.email_pass:
        logger.warning("Email credentials not configured, skipping email")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.email_user
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        if attachment_bytes and attachment_name:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{attachment_name}"')
            msg.attach(part)

        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.email_user,
            password=settings.email_pass,
        )
        logger.info(f"Email sent to {to}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


async def send_filter_notification(
    total_uploaded: int,
    filtered_count: int,
    already_placed_count: int,
    filters_used: Dict,
):
    if not settings.notification_email:
        return

    filters_html = "".join(
        f"<tr><td style='padding:4px 8px;color:#6b7280'>{k}</td>"
        f"<td style='padding:4px 8px;font-weight:600'>{v}</td></tr>"
        for k, v in filters_used.items()
        if v not in [None, "", "all", 0]
    ) or "<tr><td colspan='2' style='color:#6b7280;padding:4px 8px'>No filters applied</td></tr>"

    body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
      <h2 style="color:#1e293b;margin-bottom:4px">📊 Internship Filter Report</h2>
      <p style="color:#64748b;margin-top:0">A filter operation was performed on the internship applicant database.</p>
      
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0">
        <div style="background:#fff;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0">
          <div style="font-size:28px;font-weight:700;color:#3b82f6">{total_uploaded}</div>
          <div style="color:#6b7280;font-size:13px">Total Uploaded</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0">
          <div style="font-size:28px;font-weight:700;color:#ef4444">{already_placed_count}</div>
          <div style="color:#6b7280;font-size:13px">Already Placed</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0">
          <div style="font-size:28px;font-weight:700;color:#10b981">{filtered_count}</div>
          <div style="color:#6b7280;font-size:13px">Eligible Students</div>
        </div>
      </div>
      
      <h3 style="color:#1e293b">Filters Applied</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
        {filters_html}
      </table>
      
      <p style="color:#94a3b8;font-size:12px;margin-top:20px">
        Sent by Internship Manager System
      </p>
    </div>
    """

    await send_email(
        to=settings.notification_email,
        subject=f"Filter Report: {filtered_count} Eligible Students Found",
        body=body,
    )


async def send_download_notification(filtered_count: int, csv_bytes: bytes, filename: str):
    if not settings.notification_email:
        return

    body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
      <h2 style="color:#1e293b">📥 CSV Download Report</h2>
      <p style="color:#64748b">An admin downloaded filtered applicant data.</p>
      <div style="background:#fff;border-radius:8px;padding:16px;border:1px solid #e2e8f0;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#10b981">{filtered_count}</div>
        <div style="color:#6b7280">Students in attached CSV</div>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:20px">Internship Manager System</p>
    </div>
    """

    await send_email(
        to=settings.notification_email,
        subject=f"Download: {filtered_count} Student Records",
        body=body,
        attachment_bytes=csv_bytes,
        attachment_name=filename,
    )
