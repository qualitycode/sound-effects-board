"""Loopback-only preview. No write endpoints or third-party services."""
import argparse
import functools
import http.server
from pathlib import Path
import threading
import webbrowser
from prepare_project import prepare


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        super().end_headers()

    def do_GET(self):
        if self.headers.get('Host', '') not in ('127.0.0.1:' + str(self.server.server_port), 'localhost:' + str(self.server.server_port)):
            self.send_error(403)
            return
        # Refuse symlinks outside the static root and directory listings.
        target = Path(self.translate_path(self.path)).resolve()
        root = Path(self.directory).resolve()
        if not target.is_relative_to(root) or (target.is_dir() and not (target / 'index.html').is_file()):
            self.send_error(404)
            return
        super().do_GET()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-open', action='store_true')
    parser.add_argument('--board-folder')
    args = parser.parse_args()
    prepare(args.board_folder)
    handler = functools.partial(Handler, directory=str(Path(__file__).resolve().parent / 'dist'))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'Browser preview: {url}\nKeep this window open. Ctrl+C stops the preview.', flush=True)
    if not args.no_open:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
