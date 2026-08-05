"""Small shared helpers for HTMX handlers."""

from html import escape


def callout(variant: str, msg: str) -> str:
    """Build a <wa-callout> HTML fragment (danger|success|warning|info)."""
    return (
        f'<wa-callout variant="{escape(variant, quote=True)}">'
        f"<span>{escape(msg, quote=True)}</span></wa-callout>"
    )
