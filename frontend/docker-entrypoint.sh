#!/bin/sh
set -eu

/gen-config.sh /usr/share/nginx/html

exec nginx -g 'daemon off;'
