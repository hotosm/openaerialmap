"""Make the coverage script importable without a database."""

import os
import sys
from pathlib import Path

# The script reads its connection settings on import; tests never connect.
os.environ.setdefault("PG_DSN", "postgresql://test@localhost/test")
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
