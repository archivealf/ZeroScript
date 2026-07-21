#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# start(MacOS).command
# Delegate to the cross-platform launcher.

set -u
cd "$(dirname "$0")"

is_python39() {
    command -v "$1" >/dev/null 2>&1 || return 1
    "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1
}

if is_python39 python3; then
    exec python3 start.py "$@"
fi

if is_python39 python; then
    exec python start.py "$@"
fi

echo "ERROR: Python 3.9+ not found. Install Python 3.9 or newer and rerun start.py."
read -n 1 -s -r -p "Press any key to close..."
exit 1
