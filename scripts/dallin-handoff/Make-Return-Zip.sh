#!/bin/bash
set -eu
cd "$(dirname "$0")"
count=0
for audio in 'Finished/Clock Single Strike.wav' 'Finished/Clock Single Strike.mp3'; do
    if [ -f "$audio" ]; then
        if [ ! -s "$audio" ]; then echo "Audio file is empty: $audio"; exit 1; fi
        count=$((count + 1))
    fi
done
if [ "$count" -ne 1 ]; then
    echo 'Save exactly one Clock Single Strike.wav or .mp3 in Finished first.'
    exit 1
fi
archive="../Dallin-Clock-Update-$(date +%Y%m%d-%H%M%S)-$$.zip"
zip -r "$archive" Finished Changes.txt READ-ME.txt -x '*/.DS_Store' '*/._*'
echo "Send this ZIP to Larry: $(cd .. && pwd)/$(basename "$archive")"
