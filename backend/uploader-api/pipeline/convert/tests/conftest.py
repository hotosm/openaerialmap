"""Put the convert step module on sys.path so tests can `import convert`."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
