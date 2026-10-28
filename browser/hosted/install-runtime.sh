#!/usr/bin/env bash
# Install only the soundboard's interpreter; never change PATH or system Node.
set -euo pipefail
cd -- "$(dirname -- "$0")/../.."
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
    echo 'This package targets the verified Linux x86_64 server.' >&2
    exit 1
fi
version=v22.23.4
archive="node-${version}-linux-x64.tar.xz"
expected=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce
if [[ -x runtime/bin/node ]]; then
    if [[ "$(runtime/bin/node --version)" == "$version" ]]; then
        echo "Soundboard runtime already installed: $version"
        exit 0
    fi
    echo 'A different runtime already exists; leaving it unchanged.' >&2
    exit 1
fi
if [[ -e runtime ]]; then
    echo 'The runtime folder already exists; inspect it before installing.' >&2
    exit 1
fi
command -v curl >/dev/null
command -v sha256sum >/dev/null
mkdir -p .runtime-download
curl --fail --show-error --location --proto '=https' --tlsv1.2 \
    "https://nodejs.org/download/release/$version/$archive" \
    --output ".runtime-download/$archive"
printf '%s  %s\n' "$expected" ".runtime-download/$archive" | sha256sum --check --status
mkdir runtime
tar -xJf ".runtime-download/$archive" --strip-components=1 -C runtime
runtime/bin/node --version
echo 'Soundboard runtime installed. System Node and existing PM2 apps are unchanged.'
