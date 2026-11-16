"""Put convert, and the API's disk bound, on sys.path for the tests."""

import os
import sys

STEP = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, STEP)
# In the repository the bound lives in the API; the test image copies it.
for bound in ("../../app/uploads", "../budget"):
    sys.path.insert(0, os.path.normpath(os.path.join(STEP, bound)))
