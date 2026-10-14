"""Prepare this private production's cue plan using the downloaded sound pack."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder = root / 'assets/playScript'
script = json.loads((folder / 'script.json').read_text(encoding='utf-8'))
script['presetVersion'] = 'christmas-carol-2026-10-13-v1'
plan = {}

def a(label, action='play', delay=0, repeat=1):
    return dict(label=label, action=action, delay=delay, repeat=repeat)

def cue(id, *actions, note=''):
    plan[id] = dict(actions=list(actions), note=note)

wind = 'Wind (loop)'
chains = 'Chains Rattle (long)'
short = 'Chains Rattle (short)'
fire = 'Fireplace (loop)'
slippers = 'Shuffling Slippers'
echo = 'Echoing Footsteps'
steps = 'Climbing Wooden Steps'
spoon = 'Spoon in Gruel Bowl'
clock = 'Clock Single Strike'
dance = 'Dancing Feet (loop)'
street = ['Horse Carriage (cobblestones)', 'Street Crowd', 'Carol Singing (street)', 'Hurdy Gurdy (street organ)', 'Street Violin', 'Accordion']

cue('p12-c1', a(clock, repeat=3), note='Three strikes, replaying the single-strike recording after each finish. Rehearse the spacing.')
for id in ['p12-c2', 'p14-c1', 'p14-c3']:
    cue(id, a('Door Opens'), a(wind, 'hold'))
for id in ['p12-c3', 'p14-c2', 'p14-c4']:
    cue(id, a('Door Closes'), a(wind, 'stop'))
cue('p15-c1', a('Door Opens'), a(wind, 'hold'), a('Door Closes', delay=2), a(wind, 'stop', delay=2), note='Door closes after 2 seconds. Adjust the delay to the actor’s exit in rehearsal.')
cue('p15-c2', a(wind, 'hold'), a('Door Opens'))
cue('p15-c3', a('Door Slam'), a(wind, 'stop'), a(clock, delay=1, repeat=5), note='Five strikes after the slam; adjust the starting delay in rehearsal.')
cue('p16-c1', a('Scurrying Feet', 'loop'), note='Stop the scuffling when Cratchit leaves; the next cue does this.')
cue('p16-c2', a('Scurrying Feet', 'stop'), a('Door Opens'), a(wind, 'hold'), a('Door Slam', delay=2), a(wind, 'stop', delay=2), note='Exit sequence uses a 2-second delay before the slam; adjust in rehearsal.')
cue('p16-c3', a('Door Slam'), a('Key in Lock', delay=1), a('Footsteps (cobblestones)', 'loop', delay=2))
cue('p16-c4', a('Footsteps (cobblestones)', 'stop'), a(steps, 'loop'))
cue('p17-c1', a(steps, 'stop'))
cue('p17-c2', a('Ring of Keys'))
cue('p17-c3', a('Latch Click'), a('Door Opens', delay=.5), a('Door Shut Hard', delay=3), a('Latch Click', delay=3.5), note='Room-check pause defaults to about 2.5 seconds; adjust the action delays to the actor.')
for id in ['p17-c4', 'p17-c5']:
    cue(id, a('Key in Lock'))
cue('p17-c6', a(fire, 'hold'), a(spoon, 'loop'))
cue('p18-c1', a(spoon, 'stop'), a(short))
cue('p18-c2', a(short), note='The supplied chain recording has no added off-mic/echo processing; replace or mix it for the intended perspective.')
cue('p18-c3', a(chains, 'loop'), note='Background chains continue until a stop cue. Adjust level for dialogue.')
cue('p19-c1', a(chains, 'stop'), a(short, repeat=2), note='Two short rattles approximate the violent shake; replace with a stronger recording if needed.')
cue('p19-c2', a(chains, 'loop'), note='Use Stop/Fade in the scene panel to follow Marley’s movements.')
cue('p19-c3', a(short), note='Scrooge and Marley supply their moans live; this button plays chains only.')
cue('p19-c4', a(chains, 'stop'), a(short, 'stop'))
cue('p19-c5', a(short), note='This is a manual action cue: click again for each link/movement in the dialogue, rather than looping continuously.')
cue('p20-c1', a(short, repeat=2))
cue('p20-c2', a(fire, 'stop'), a('Window Opens'), a(wind, 'hold'), a(chains, 'loop'), a('Chains Dragging', 'loop'), a('Ghosts Wailing', 'loop'), note='Layered ghost scene. Audition levels under the actors; fades are provided on page 21.')
cue('p21-c1', a(wind, 'hold'), note='Continue existing wind without restarting it.')
cue('p21-c2', a('Ghosts Wailing', 'fade'), a(chains, 'fade'), a('Chains Dragging', 'fade'), a(short, 'stop'), a(wind, 'hold'))
cue('p21-c3', a('Window Closes'), a(wind, 'stop'), a('Latch Click', delay=.4))
cue('p21-c4', a(slippers, 'play'))
cue('p21-c5', a(slippers, 'stop'), a('Door Opens'))
cue('p21-c6', a('Door Closes'))
cue('p21-c7', a(clock))
cue('p21-c8', a('Curtains on Rings'))
cue('p22-c1', a('Bed Springs / Covers'))
cue('p22-c2', a(slippers))
cue('p22-c3', a(slippers, 'stop'), a('Window Opens'), a(wind, 'hold'))
cue('p22-c4', a(wind, 'hold'), a('Window Closes', delay=2), a(wind, 'stop', delay=2), note='Travel wind lasts 2 seconds before the window closes. Stronger/louder wind needs level adjustment in rehearsal.')
cue('p22-c5', a(echo, 'loop'))
cue('p23-c1', a(echo, 'stop'), a('Knock at Door'))
cue('p23-c2', a('Door Opens'), a('Little Girl Running', delay=.4))
cue('p23-c3', a('Little Girl Running'), note='Use Fade for the movement away from the microphone if the recording runs longer than the actor.')
cue('p24-c1', a('Little Girl Running', 'stop'), a('Door Closes'))
cue('p24-c2', a(wind, 'loop'), a(wind, 'fade', delay=2), note='Transition wind starts fading after 2 seconds; adjust for the scene change.')
cue('p25-c1', a('Door Opens'), a('Scurrying Feet'), a('Furniture Scraping', delay=.4), a('Street Crowd', 'loop'), note='Street Crowd substitutes for party preparation voices. Actors can supply the rhubarb.')
cue('p25-c2', a('Street Crowd', 'stop'), a(dance, 'loop'))
cue('p25-c3', a(dance, 'fade'), a('Clapping'), a('Crowd Laughter'), note='Fade the dance under dialogue; applause/laughter play once.')
cue('p26-c1', a(wind, 'loop'), a('Wind Chimes (loop)', 'loop'), a(wind, 'fade', delay=2), a('Wind Chimes (loop)', 'fade', delay=2))
cue('p26-c2', a(wind, 'loop'), a('Wind Chimes (loop)', 'loop'), note='Held transition. Act II’s first cue stops these backgrounds.')
cue('p28-c1', a(wind, 'stop'), a('Wind Chimes (loop)', 'stop'), a(clock), note='One single strike. The recording is not the exact “bing, bing, bing, ding” musical clock pattern; replace if required.')
cue('p28-c2', a(slippers))
cue('p29-c1', a(slippers, 'stop'), a('Door Knob Turns'), a('Door Opens', delay=.5), a('Small Bells', delay=.7), a('Jingle Bells (tinkly)', delay=.7), note='Ghost’s laughter comes from the actor; bell layers play once.')
cue('p29-c2', a(fire, 'loop'))
cue('p29-c3', a(fire, 'stop'), *(a(label, 'loop') for label in street), a('Jingle Bells (tinkly)'), a('Crowd Laughter'), a('Horse Whinny', delay=3), note='Available street instruments, crowd, carriage, bells and horse layered together. Beggars/street sellers can be live; dog and pots/pans recordings are absent. Rehearse mix levels.')
for id in ['p30-c1', 'p30-c3', 'p30-c5', 'p30-c6']:
    cue(id, a('Torch Sprinkle'))
cue('p30-c2', a('Packages Dropped'))
cue('p30-c4', a('Packages Stacked'))
cue('p31-c1', *(a(label, 'fade') for label in street), a(wind, 'loop'), note='Fade out the street montage for the Cratchit scene.')
cue('p31-c2', a('Door Opens'))
cue('p31-c3', a('Door Closes'), a(wind, 'stop'))
cue('p31-c4', a('Scurrying Feet'), a('Furniture Scraping', delay=.3), a('Door Opens', delay=1))
cue('p32-c1', a('Scurrying Feet'), a("Tiny Tim's Wooden Crutch"), note='Crutch and footsteps play once. Use Fade if the recordings continue after the children leave.')
cue('p32-c2', a('Scurrying Feet'), a("Tiny Tim's Wooden Crutch"), note='Play once for the returning children; this recording has no automatic fade-in.')
cue('p33-c1', a('Scurrying Feet'), a('Table Settings', delay=.4), a("Tiny Tim's Wooden Crutch", 'stop'))
cue('p39-c1', a('Heavy Cloth Murmur'))
cue('p39-c2', a('Clock Strikes Twelve'), note='Use the existing midnight recording. Actors deliver the voices; check its length against the Spirit’s exit.')
cue('p40-c1', a(wind, 'loop'))
cue('p40-c2', a('Door Opens'))
cue('p40-c3', a('Door Closes'), a(wind, 'stop'))
cue('p41-c1', a('Scurrying Feet'), note='Family exit voices are live. Use Fade to match their exit.')
for id in ['p43-c1', 'p43-c2']:
    cue(id, a('Door Squeals (rusty)'), note='The same rusty-hinge recording is used for opening and closing; replace either assignment if a distinct close is preferred.')
cue('p43-c3', a('Items on Counter'), note='Click again for each item Whitlow puts down; the timing follows the actor.')
cue('p43-c4', a('A Few Coins'))
cue('p44-c1', a('Heavy Fabric Moving'), a('Boots Clunk', delay=.5), a('Silver Clatter', delay=1), note='Bundle sequence uses half-second spacing; adjust to the actor’s movements.')
cue('p44-c2', a('More and Heavier Coins'))
cue('p44-c3', a('Heavy Fabric Moving'))
cue('p44-c4', a('Curtains on Rings'))
cue('p45-c1', a('Horse-Drawn Cab Passes'))
cue('p45-c2', a(wind, 'loop'), note='Hold wind through the speech. The following footsteps cue fades it, or use Fade manually to follow Scrooge.')
cue('p45-c3', a(wind, 'fade'), a(echo), note='Echoing Footsteps substitutes for light steps; adjust/re-record if the room perspective needs less echo.')
cue('p46-c1', a(echo, 'stop'), a('Window Opens'))
cue('p46-c2', a('Window Closes'))
cue('p47-c1', a(clock, repeat=9), note='Nine single strikes, each after the previous recording finishes. The next cue lets the operator end the striking.')
cue('p47-c2', a(clock, 'stop'))
cue('p47-c3', a('Clock Chimes'), note='Clock Chimes substitutes for a quarter-hour pattern; audition/replace if an exact quarter-hour melody is required.')
cue('p47-c4', a(clock), a('Door Opens', delay=.3), a(wind, 'hold', delay=.3), a('Door Closes', delay=2), a(wind, 'stop', delay=2), note='Bob’s entrance closes after 2 seconds by default; adjust to performance timing.')
cue('p47-c5', a('Chair Scuff and Sit'))

labels = {pad['label'] for pad in json.loads((root / 'soundpack/pack.json').read_text())['pads']}
ids = {b['id'] for p in script['pages'] for b in p['blocks'] if 'cue' in b}
assert ids == set(plan), (ids - set(plan), set(plan) - ids)
assert all(action['label'] in labels for c in plan.values() for action in c['actions'])
for page in script['pages']:
    for block in page['blocks']:
        if 'cue' in block:
            block['defaults'] = plan[block['id']]['actions']
            block['note'] = plan[block['id']]['note']
(folder / 'cue-plan.json').write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding='utf-8')
(folder / 'script.json').write_text(json.dumps(script, indent=2, ensure_ascii=False), encoding='utf-8')
report = ['# Prepared cue assignments', '', 'All 95 cues are assigned using the project sound pack. Delays are rehearsal starting points. First use backs up previous assignments and installs this prepared set; later edits are preserved.', '', '| Cue | Direction | Actions | Rehearsal note |', '|---|---|---|---|']
for page in script['pages']:
    for block in page['blocks']:
        if 'cue' not in block: continue
        actions = '; '.join(f"{a['action']} {a['label']}" + (f" ×{a['repeat']}" if a['repeat'] > 1 else '') + (f" at {a['delay']}s" if a['delay'] else '') for a in block['defaults'])
        report.append(f"| {block['id']} | {block['cue']} | {actions} | {block['note']} |")
(folder / 'prepared-cues.md').write_text('\n'.join(report), encoding='utf-8')
print(f'Prepared {len(plan)} cues with {sum(len(c["actions"]) for c in plan.values())} actions')
