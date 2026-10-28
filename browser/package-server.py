"""Package only hosted program source; never include recordings or credentials."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'browser/dist/index.html', 'browser/dist/styles.css',
    'browser/dist/renderer.js', 'browser/dist/script-view.js',
    'browser/dist/browser-api.js', 'browser/dist/script-highlights.js',
    'browser/hosted/server.cjs', 'browser/hosted/start.cjs',
    'browser/hosted/backup.cjs', 'browser/hosted/password.cjs',
    'browser/hosted/hosted.js', 'browser/hosted/sw.js',
    'browser/hosted/ecosystem.config.js',
    'browser/hosted/install-runtime.sh',
    'browser/hosted/nginx-location.conf', 'browser/hosted/README.md',
]


def package():
    output = ROOT / 'handoffs' / 'soundboard-server.zip'
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for name in FILES:
            data = (ROOT / name).read_bytes()
            if name.endswith('.sh'):
                data = data.replace(b'\r\n', b'\n')
            bundle.writestr(name, data)
    with zipfile.ZipFile(output) as bundle:
        assert bundle.namelist() == FILES
        assert bundle.testzip() is None
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.zip.sha256').write_text(f'{digest}  {output.name}\n', encoding='ascii')
    print(f'Created {output}: {len(FILES)} source files, {output.stat().st_size} bytes; no media, desktop app, or credentials.')


if __name__ == '__main__':
    package()
