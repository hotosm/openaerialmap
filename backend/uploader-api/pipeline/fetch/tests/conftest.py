"""Put the fetch step and the API's url_guard on sys.path."""

import os
import sys

_STEP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _STEP)

_API_UPLOADS = os.path.abspath(os.path.join(_STEP, "..", "..", "app", "uploads"))
if os.path.isdir(_API_UPLOADS):
    sys.path.insert(0, _API_UPLOADS)
