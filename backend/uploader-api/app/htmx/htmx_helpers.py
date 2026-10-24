"""Small shared helpers for HTMX handlers."""

from html import escape

from app.config import settings


def support_html() -> str:
    """Build the "ask us for help" line that accompanies a failure.

    The tech-request form leads: unlike Slack it needs no account, and most
    contributors hitting an upload failure are not in the HOT workspace.
    """
    if not settings.SUPPORT_URL:
        return ""
    slack = ""
    if settings.SUPPORT_SLACK_URL:
        slack = (
            ', or ask in <a href="'
            f'{escape(settings.SUPPORT_SLACK_URL, quote=True)}"'
            ' target="_blank" rel="noreferrer">HOT Slack</a>'
        )
    return (
        '<p class="oam-support">Trouble uploading your imagery? '
        f'<a href="{escape(settings.SUPPORT_URL, quote=True)}"'
        ' target="_blank" rel="noreferrer">Contact the OAM team for support</a>'
        f"{slack} - quote the message above and we will look into it.</p>"
    )


def callout(variant: str, msg: str) -> str:
    """Build a <wa-callout> HTML fragment (danger|success|warning|info)."""
    # Only a failure leaves the user stuck, so only it carries the way out.
    support = support_html() if variant == "danger" else ""
    return (
        f'<wa-callout variant="{escape(variant, quote=True)}">'
        f"<span>{escape(msg, quote=True)}</span>{support}</wa-callout>"
    )
