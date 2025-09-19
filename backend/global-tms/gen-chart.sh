#!/bin/bash

set -euo pipefail

# First go to chart/Chart.yaml and increment version & appVersion

helm package chart
# Update version to match here
helm push global-tms-0.1.1.tgz oci://ghcr.io/hotosm/openaerialmap
