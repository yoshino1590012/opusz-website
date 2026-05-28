#!/usr/bin/env python3
"""
OPUS.Z dev server
— Serves static files with HTTP/1.1 + byte-range support (required for video seeking)
— POST /save-videos   → writes video URLs into musician-platform.html permanently
— POST /upload-file   → saves uploaded photo/video as real file in assets/images/
— POST /save-config   → saves photo layout config to config.json
"""
import http.server, socketserver, json, re, os, sys, base64, mimetypes, threading, subprocess

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
BASE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(BASE, 'musician-platform.html')

class Handler(http.server.SimpleHTTPRequestHandler):
    # Use HTTP/1.1 so browsers trust Accept-Ranges and byte-range seeks work
    protocol_version = 'HTTP/1.1'

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    def do_GET(self):
        """Serve files with byte-range support so Chrome can seek video."""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            super().do_GET()
            return

        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return

        try:
            file_size = os.path.getsize(path)
            ctype = mimetypes.guess_type(path)[0] or 'application/octet-stream'

            range_header = self.headers.get('Range')
            if range_header:
                # Parse "bytes=start-end"
                try:
                    byte_range = range_header.strip().replace('bytes=', '')
                    parts = byte_range.split('-')
                    start = int(parts[0]) if parts[0] else 0
                    end   = int(parts[1]) if parts[1] else file_size - 1
                    end   = min(end, file_size - 1)
                    length = end - start + 1

                    f.seek(start)
                    self.send_response(206)
                    self.send_header('Content-Type', ctype)
                    self.send_header('Content-Length', str(length))
                    self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                    self.send_header('Accept-Ranges', 'bytes')
                    self.send_header('Cache-Control', 'no-cache')
                    self.end_headers()
                    # Stream in 64KB chunks
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(65536, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
                except Exception:
                    self.send_error(416, 'Range not satisfiable')
            else:
                self.send_response(200)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Length', str(file_size))
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                # Stream in 64KB chunks — never load entire file into RAM
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        finally:
            f.close()

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors(); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(n)

        # ── /save-videos ──────────────────────────────────────────────────────
        if self.path == '/save-videos':
            try:
                data = json.loads(raw)
                with open(HTML, 'r', encoding='utf-8') as f:
                    html = f.read()
                new_block = (
                    '<script id="sv-video-config" type="application/json">\n'
                    + json.dumps({str(k): str(v) for k, v in data.items()}, ensure_ascii=False, indent=2)
                    + '\n</script>'
                )
                html = re.sub(
                    r'<script id="sv-video-config"[^>]*>.*?</script>',
                    new_block, html, flags=re.DOTALL
                )
                with open(HTML, 'w', encoding='utf-8') as f:
                    f.write(html)
                self._ok(b'{"ok":true}')
                print(f'[save-videos] wrote {len(data)} URLs')
            except Exception as e:
                self._err(e)

        # ── /upload-file ───────────────────────────────────────────────────────
        # Body: { "cls": "p1", "dataUrl": "data:image/jpeg;base64,..." }
        # Saves to assets/images/{cls}.jpg  and returns { "ok": true, "path": "assets/images/p1.jpg" }
        elif self.path == '/upload-file':
            try:
                data    = json.loads(raw)
                cls     = re.sub(r'[^a-zA-Z0-9_\-]', '_', data.get('cls', 'img'))
                dataUrl = data.get('dataUrl', '')

                # Parse  data:<mime>;base64,<data>
                m = re.match(r'data:image/(\w+);base64,(.*)', dataUrl, re.DOTALL)
                if not m:
                    raise ValueError('Invalid dataUrl — expected data:image/…;base64,…')

                ext    = {'jpeg':'jpg','jpg':'jpg','png':'png','webp':'webp','gif':'gif'}.get(m.group(1).lower(), 'jpg')
                imgbin = base64.b64decode(m.group(2))

                save_dir = os.path.join(BASE, 'assets', 'images')
                os.makedirs(save_dir, exist_ok=True)
                filename  = f'{cls}.{ext}'
                save_path = os.path.join(save_dir, filename)
                with open(save_path, 'wb') as f:
                    f.write(imgbin)

                rel_path = f'assets/images/{filename}'
                self._ok(json.dumps({'ok': True, 'path': rel_path}).encode())
                print(f'[upload-file] {rel_path}  ({len(imgbin)//1024} KB)')

            except Exception as e:
                self._err(e)

        # ── /save-config ───────────────────────────────────────────────────────
        # Body: { "images": { "p1": "assets/images/p1.jpg", … }, "positions": {…} }
        # Saves to config.json so any browser / machine can restore the layout
        elif self.path == '/save-config':
            try:
                cfg = json.loads(raw)
                cfg_path = os.path.join(BASE, 'site-data.json')
                with open(cfg_path, 'w', encoding='utf-8') as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
                self._ok(b'{"ok":true}')
                print(f'[save-config] site-data.json updated')
            except Exception as e:
                self._err(e)

        # ── /git-push ──────────────────────────────────────────────────────────
        elif self.path == '/git-push':
            try:
                import os as _os
                # Inherit full shell environment so gh/credential helpers work
                git_env = _os.environ.copy()
                git_env['GIT_TERMINAL_PROMPT'] = '0'  # never hang waiting for password
                # Ensure Homebrew binaries (gh) are on PATH
                git_env['PATH'] = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + git_env.get('PATH','')

                subprocess.run(['git', 'add', '-A'], cwd=BASE, capture_output=True, text=True, env=git_env)
                status = subprocess.run(['git', 'status', '--porcelain'], cwd=BASE, capture_output=True, text=True, env=git_env)
                if status.stdout.strip():
                    subprocess.run(['git', 'commit', '-m', 'Update photos and layout via editor'], cwd=BASE, capture_output=True, text=True, env=git_env)
                push = subprocess.run(['git', 'push'], cwd=BASE, capture_output=True, text=True, timeout=30, env=git_env)
                if push.returncode == 0:
                    self._ok(b'{"ok":true}')
                    print('[git-push] pushed successfully')
                else:
                    raise Exception(push.stderr or push.stdout)
            except subprocess.TimeoutExpired:
                self._err(Exception('git push timeout — check internet connection'))
            except Exception as e:
                self._err(e)

        else:
            self.send_response(404); self.end_headers()

    # ── helpers ───────────────────────────────────────────────────────────────
    def _ok(self, body):
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def _err(self, e):
        self.send_response(500)
        self._cors(); self.end_headers()
        self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())
        print(f'[ERROR] {e}')

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        pass  # quiet

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True   # threads die when server dies

with ThreadedTCPServer(('', PORT), Handler) as httpd:
    print(f'OPUS.Z server → http://localhost:{PORT}/musician-platform.html')
    httpd.serve_forever()
