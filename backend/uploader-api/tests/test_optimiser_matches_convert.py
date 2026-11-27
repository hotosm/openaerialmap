"""The browser optimiser must write what convert.py writes.

Otherwise optimised uploads silently stop skipping conversion.
"""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONVERT = ROOT / "pipeline" / "convert" / "convert.py"
OPTIMISER = ROOT / "optimiser" / "src" / "native" / "optimiser.cpp"


def _convert_defaults() -> dict[str, str]:
    """Module constants, using the default of any os.environ.get(...)."""
    values = {}
    assigns = [
        n for n in ast.parse(CONVERT.read_text()).body if isinstance(n, ast.Assign)
    ]
    for node in assigns:
        value = node.value
        if isinstance(value, ast.Call) and len(value.args) == 2:
            value = value.args[1]
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            values[node.targets[0].id] = value.value
    return values


def test_optimiser_uses_the_convert_settings():
    convert = _convert_defaults()
    optimiser = OPTIMISER.read_text()
    expected = [
        f'"COMPRESS={convert["VISUAL_COMPRESS"]}"',
        f'"QUALITY={convert["VISUAL_QUALITY"]}"',
        f'"BLOCKSIZE={convert["BLOCKSIZE"]}"',
        f'"OVERVIEWS={convert["OVERVIEWS"]}"',
        f'"OVERVIEW_RESAMPLING={convert["OVERVIEW_RESAMPLING"].upper()}"',
        f'"COG_TMP_COMPRESSION", "{convert["TMP_COMPRESSION"]}"',
    ]
    missing = [setting for setting in expected if setting not in optimiser]
    assert not missing, f"optimiser.cpp is out of step with convert.py: {missing}"
