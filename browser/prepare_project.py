"""Make a private, read-only-source snapshot for the browser prototype."""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def prepare(source=None):
    destination = ROOT / 'dist' / 'local-project'
    # Never replace an existing snapshot implicitly. Browser edits live in IndexedDB.
    if destination.exists():
        return destination
    source = Path(source) if source else Path(os.environ.get('APPDATA', '')) / 'Sound Effects Board'
    if not (source / 'pads.json').is_file():
        raise ValueError(f'No saved board found at {source}. Use --board-folder to select a saved board copy.')
    pads = load(source / 'pads.json')['pads']
    script_path = source / 'script.json'
    if not script_path.exists():
        script_path = PROJECT / 'assets' / 'playScript' / 'script.json'
    script = load(script_path)
    saved = load(source / 'script-cues.json') if (source / 'script-cues.json').exists() else {}
    assignments = {}
    for page in script['pages']:
        for index, block in enumerate(page['blocks']):
            block.setdefault('id', f"p{page['page']}-b{index}")
            if not block.get('cue'):
                continue
            if block['id'] in saved:
                # Actual saved IDs win, even if labels have changed or sounds are missing.
                assignments[block['id']] = saved[block['id']]
            elif block.get('defaults'):
                assignments[block['id']] = [
                    dict(padId=next((p['id'] for p in pads if p['label'].lower() == a.get('label', '').lower()), ''),
                         action=a.get('action', 'play'), delay=a.get('delay', 0), repeat=a.get('repeat', 1))
                    for a in block['defaults']
                ]
            else:
                assignments[block['id']] = []
    payload = dict(schemaVersion=1, title=script.get('title', 'Sound Effects Board'), pads=pads,
                   script=script, assignments=assignments, people=[], passages={}, cues={})
    files = []
    staging = Path(tempfile.mkdtemp(prefix='snapshot-', dir=ROOT))
    try:
        (staging / 'media').mkdir()
        names = {p.get(kind) for p in pads for kind in ('sound', 'image')} - {None, ''}
        for name in sorted(names):
            if Path(name).name != name or '/' in name or '\\' in name:
                raise ValueError(f'Invalid media filename: {name}')
            original = source / 'media' / name
            if not original.is_file():
                raise ValueError(f'Missing saved recording/image: {name}')
            shutil.copy2(original, staging / 'media' / name)
            mime = mimetypes.guess_type(name)[0] or 'application/octet-stream'
            files.append(dict(name=name, mime=mime, sha256=hashlib.sha256(original.read_bytes()).hexdigest()))
        credits = PROJECT / 'soundpack' / 'CREDITS.md'
        if credits.exists():
            shutil.copy2(credits, staging / 'SOUND-CREDITS.md')
        (staging / 'project.json').write_text(json.dumps(dict(project=payload, files=files), ensure_ascii=False), encoding='utf-8')
        staging.rename(destination)
    finally:
        # Only remove the temporary directory created by this function, inside browser/.
        if staging.exists() and staging.parent.resolve() == ROOT.resolve() and staging.name.startswith('snapshot-'):
            shutil.rmtree(staging)
    print(f'Copied {len(pads)} sounds, {len(assignments)} cues and {len(script["pages"])} script pages. Desktop files unchanged.')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--board-folder', help='Optional saved board folder containing pads.json and media/')
    args = parser.parse_args()
    prepare(args.board_folder)
