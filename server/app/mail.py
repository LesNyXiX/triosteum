"""Отправка писем через SMTP: приглашения и восстановление пароля.

Подойдёт бесплатная почта Яндекса или Mail.ru с паролем приложения, либо почта компании:
  SMTP_HOST=smtp.yandex.ru  SMTP_PORT=465  SMTP_USER=triosteum@yandex.ru  SMTP_PASSWORD=<пароль приложения>
  MAIL_FROM="Triosteum <triosteum@yandex.ru>"  PUBLIC_URL=https://triosteum.example.ru
Если SMTP_HOST не задан, письма не отправляются — ссылку можно скопировать вручную.
"""
import html
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid


def configured() -> bool:
    return bool(os.environ.get("SMTP_HOST"))


def public_url(fallback: str) -> str:
    return (os.environ.get("PUBLIC_URL") or fallback).rstrip("/")


def _sender() -> str:
    return os.environ.get("MAIL_FROM") or formataddr(("Triosteum", os.environ.get("SMTP_USER", "triosteum@localhost")))


def send(to: str, subject: str, text: str, html_body: str) -> None:
    """Отправить письмо. Бросает исключение, если не получилось."""
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "465"))
    user, password = os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASSWORD")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = _sender(), to, subject
    msg["Message-ID"] = make_msgid(domain=(os.environ.get("SMTP_USER", "triosteum@localhost").split("@")[-1] or "localhost"))
    msg.set_content(text)
    msg.add_alternative(html_body, subtype="html")
    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as s:
            if user:
                s.login(user, password or "")
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as s:
            if os.environ.get("SMTP_STARTTLS", "1") not in ("0", "false", "no"):
                s.starttls(context=ctx)
            if user:
                s.login(user, password or "")
            s.send_message(msg)


def _layout(title: str, lines: list[str], button: str, link: str, foot: str) -> str:
    p = "".join(f'<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3b2a2e">{html.escape(t)}</p>' for t in lines)
    return f"""<!DOCTYPE html><html lang="ru"><body style="margin:0;padding:24px;background:#f5eff0;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px" cellspacing="0" cellpadding="0"><tr><td>
<div style="font-weight:700;font-size:18px;color:#12090b;margin-bottom:20px"><span style="display:inline-block;width:18px;height:18px;border-radius:5px;background:#dc2626;vertical-align:-3px;margin-right:8px"></span>Triosteum</div>
<h1 style="margin:0 0 14px;font-size:21px;color:#12090b">{html.escape(title)}</h1>{p}
<p style="margin:22px 0"><a href="{html.escape(link, quote=True)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#dc2626;color:#ffffff;font-weight:700;text-decoration:none">{html.escape(button)}</a></p>
<p style="margin:0 0 6px;font-size:12px;color:#8a7177">Если кнопка не открывается, скопируйте ссылку в браузер:</p>
<p style="margin:0 0 18px;font-size:12px;word-break:break-all"><a href="{html.escape(link, quote=True)}" style="color:#b91c1c">{html.escape(link)}</a></p>
<p style="margin:0;font-size:12px;color:#8a7177">{html.escape(foot)}</p>
</td></tr></table></td></tr></table></body></html>"""


ROLE_RU = {"editor": "редактор", "approver": "согласующий", "viewer": "наблюдатель"}


def invite_mail(to: str, org: str, inviter: str, role: str, link: str) -> None:
    title = f"Приглашение в «{org}»"
    lines = [f"{inviter} приглашает вас в организацию «{org}» в Triosteum — роль: {ROLE_RU.get(role, role)}.",
             "Откройте ссылку, задайте пароль — и сразу попадёте в общие пространства организации."]
    foot = "Ссылка одноразовая и действует 7 дней. Если вы не ждали приглашения, просто удалите это письмо."
    text = "\n\n".join([title] + lines + [link, foot])
    send(to, f"{inviter} приглашает вас в Triosteum", text, _layout(title, lines, "Принять приглашение", link, foot))


def reset_mail(to: str, link: str) -> None:
    title = "Восстановление пароля"
    lines = ["Кто-то, возможно вы, запросил смену пароля для входа в Triosteum.", "Чтобы задать новый пароль, откройте ссылку."]
    foot = "Ссылка одноразовая и действует 1 час. Если вы не запрашивали смену пароля, ничего не делайте — пароль останется прежним."
    text = "\n\n".join([title] + lines + [link, foot])
    send(to, "Восстановление пароля Triosteum", text, _layout(title, lines, "Задать новый пароль", link, foot))
