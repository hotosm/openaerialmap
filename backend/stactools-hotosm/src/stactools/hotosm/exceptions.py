"""Custom exceptions for HOTOSM OAM STAC Item creation."""


class AssetNotFoundError(FileNotFoundError):
    """Raised if an imagery asset does not exist."""
