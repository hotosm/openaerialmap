"""Put the metadata step module on sys.path so tests can `import metadata`."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
