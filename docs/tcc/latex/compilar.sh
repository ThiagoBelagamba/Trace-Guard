#!/usr/bin/env bash
# Usa o mesmo tectonic do RusselResume.
set -euo pipefail
cd "$(dirname "$0")"

TECTONIC="${TECTONIC:-$HOME/Downloads/cv/RusselResume (1)/.bin}"
export PATH="$TECTONIC:$PATH"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/Downloads/cv/RusselResume (1)/.cache}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/Downloads/cv/RusselResume (1)/.config}"

tectonic --keep-logs --keep-intermediates --print main.tex
echo
echo "PDF gerado: $(pwd)/main.pdf"
