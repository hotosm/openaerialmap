"""Package and package distribution tests."""

import importlib.metadata


def test_package_import_version():
    """Ensure our package imports and the version matches distributed metadata.

    https://packaging.python.org/en/latest/discussions/single-source-version/
    """
    from stactools.hotosm import __version__

    assert importlib.metadata.version("stactools.hotosm") == __version__
