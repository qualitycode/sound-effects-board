"""Rebuild the bundled script text using PyMuPDF (development only)."""
import json
import re
from pathlib import Path
import pymupdf

root = Path(__file__).resolve().parent.parent

def reflow(text):
    """Join PDF line wraps while keeping speaker and stage-direction breaks."""
    result = ''
    for line in text.splitlines():
        line = line.strip()
        speaker = re.match(r'^[A-Z][A-Z 0-9]+(?:\s*\([^)]*\))?\.', line)
        if result and (speaker or line.startswith('(') or result.endswith(')')):
            result += '\n'
        elif result and not result.endswith('\u00ad'):
            result += ' '
        elif result.endswith('\u00ad'):
            result = result[:-1]
        result += line
    return result

doc = pymupdf.open(root / 'assets/playScript/christmas_carol_radio__cq4_digital_script.pdf')
pages = []
plan_file = root / 'assets/playScript/cue-plan.json'
plan = json.loads(plan_file.read_text(encoding='utf-8')) if plan_file.exists() else {}
for number in range(7, len(doc)):
    lines = doc[number].get_text().splitlines()
    if lines and lines[0].strip().isdigit():
        lines.pop(0)
    lines = [line for line in lines if line.strip() != 'FOR AUTHORIZED DIGITAL USE ONLY']
    blocks = []
    index = 0
    count = 0
    while index < len(lines):
        line = lines[index]
        if 'SFX:' in line:
            prefix, cue = line.split('SFX:', 1)
            if prefix.strip(' ('):
                blocks.append({'text': prefix})
            while not cue.rstrip().endswith(')') and index + 1 < len(lines):
                following = lines[index + 1].strip()
                if following.startswith(('NOTE:', 'SFX:', 'MUSIC:')) or re.match(r'^[A-Z][A-Z 0-9]+(?:\s*\([^)]*\))?\.', following):
                    break
                index += 1
                cue += ' ' + lines[index].strip()
            count += 1
            blocks.append({'id': f'p{number + 1}-c{count}', 'cue': cue.strip().rstrip(')')})
        else:
            if blocks and 'text' in blocks[-1]:
                blocks[-1]['text'] += '\n' + line
            else:
                blocks.append({'text': line})
        index += 1
    for block in blocks:
        if 'text' in block:
            block['text'] = reflow(block['text'])
        else:
            block['cue'] = block['cue'].replace('\u00ad ', '').replace('\u00ad', '')
            if block['id'] in plan:
                block['defaults'] = plan[block['id']]['actions']
                block['note'] = plan[block['id']]['note']
    pages.append({'page': number + 1, 'blocks': blocks})
out = root / 'assets/playScript/script.json'
out.write_text(json.dumps({'title': 'A Christmas Carol', 'presetVersion': 'christmas-carol-2026-10-13-v1' if plan else '', 'pages': pages}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Extracted {len(pages)} pages and {sum("cue" in b for p in pages for b in p["blocks"])} cues')
