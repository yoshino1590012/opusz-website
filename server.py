#!/usr/bin/env python3
"""
OPUS.Z dev server
— Serves static files with HTTP/1.1 + byte-range support (required for video seeking)
— POST /save-videos          → writes video URLs into musician-platform.html permanently
— POST /upload-file          → saves uploaded photo/video as real file in assets/images/
— POST /save-config          → saves photo layout config to config.json
— POST /submit-application   → saves musician application JSON + uploads to applications/
— GET  /get-applications     → returns all applications sorted by submitted_at desc
— POST /update-application   → updates status/note on an existing application
"""
import http.server, socketserver, json, re, os, sys, base64, mimetypes, threading, subprocess, time

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
        # ── /get-applications ──────────────────────────────────────────────────
        if self.path == '/get-applications':
            try:
                apps_dir = os.path.join(BASE, 'applications')
                os.makedirs(apps_dir, exist_ok=True)
                apps = []
                for fname in os.listdir(apps_dir):
                    if fname.endswith('.json'):
                        fpath = os.path.join(apps_dir, fname)
                        with open(fpath, 'r', encoding='utf-8') as f:
                            app = json.load(f)
                        apps.append(app)
                # Sort by submitted_at descending
                apps.sort(key=lambda a: a.get('submitted_at', ''), reverse=True)
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                body = json.dumps(apps, ensure_ascii=False).encode('utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self._err(e)
            return

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

        # ── /save-shows ────────────────────────────────────────────────────────
        elif self.path == '/save-shows':
            try:
                cfg = json.loads(raw)
                cfg_path = os.path.join(BASE, 'shows-data.json')
                with open(cfg_path, 'w', encoding='utf-8') as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
                self._ok(b'{"ok":true}')
                print(f'[save-shows] shows-data.json updated')
            except Exception as e:
                self._err(e)

        # ── /submit-application ───────────────────────────────────────────────
        # Body: application JSON with optional base64 image fields
        # Saves JSON to applications/app_{timestamp}.json
        # Saves any image files to assets/images/applications/
        elif self.path == '/submit-application':
            try:
                data = json.loads(raw)
                timestamp = str(int(time.time() * 1000))
                app_id = f'app_{timestamp}'

                # Ensure directories exist
                apps_dir = os.path.join(BASE, 'applications')
                img_dir  = os.path.join(BASE, 'assets', 'images', 'applications')
                os.makedirs(apps_dir, exist_ok=True)
                os.makedirs(img_dir,  exist_ok=True)

                def save_dataurl(dataurl, name_hint):
                    """Save a base64 data URL to disk, return relative path."""
                    m = re.match(r'data:([^;]+);base64,(.*)', dataurl, re.DOTALL)
                    if not m:
                        return dataurl  # already a path or empty
                    mime  = m.group(1)
                    imgb  = base64.b64decode(m.group(2))
                    ext_map = {'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png',
                               'image/webp':'webp','image/gif':'gif',
                               'video/mp4':'mp4','video/quicktime':'mov',
                               'video/webm':'webm'}
                    ext  = ext_map.get(mime, 'bin')
                    fname = f'{app_id}_{re.sub(r"[^a-zA-Z0-9_]","_",name_hint)}.{ext}'
                    fpath = os.path.join(img_dir, fname)
                    with open(fpath, 'wb') as fh:
                        fh.write(imgb)
                    return f'assets/images/applications/{fname}'

                # Process banner photo
                if data.get('banner_photo') and data['banner_photo'].startswith('data:'):
                    data['banner_photo'] = save_dataurl(data['banner_photo'], 'banner')

                # Process additional media array
                if isinstance(data.get('additional_media'), list):
                    for i, item in enumerate(data['additional_media']):
                        if isinstance(item, dict) and item.get('dataUrl','').startswith('data:'):
                            item['path'] = save_dataurl(item['dataUrl'], f'media_{i}')
                            del item['dataUrl']
                        elif isinstance(item, str) and item.startswith('data:'):
                            data['additional_media'][i] = save_dataurl(item, f'media_{i}')

                # Process performance experience photos
                if isinstance(data.get('experiences'), list):
                    for i, exp in enumerate(data['experiences']):
                        if isinstance(exp, dict) and exp.get('photo','').startswith('data:'):
                            exp['photo'] = save_dataurl(exp['photo'], f'exp_{i}')

                # Add metadata
                data['id']           = app_id
                data['status']       = data.get('status', 'pending')
                data['submitted_at'] = data.get('submitted_at',
                    __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'))

                app_path = os.path.join(apps_dir, f'{app_id}.json')
                with open(app_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                self._ok(json.dumps({'ok': True, 'id': app_id}).encode())
                print(f'[submit-application] saved {app_id}')

            except Exception as e:
                self._err(e)

        # ── /update-application ────────────────────────────────────────────────
        # Body: { "id": "app_xxx", "status": "approved"/"rejected", "note": "..." }
        # Updates the status/note fields in the corresponding JSON file
        elif self.path == '/update-application':
            try:
                data     = json.loads(raw)
                app_id   = re.sub(r'[^a-zA-Z0-9_\-]', '', data.get('id', ''))
                status   = data.get('status', '')
                note     = data.get('note', '')

                if not app_id:
                    raise ValueError('Missing id')

                apps_dir = os.path.join(BASE, 'applications')
                app_path = os.path.join(apps_dir, f'{app_id}.json')
                if not os.path.exists(app_path):
                    raise FileNotFoundError(f'Application {app_id} not found')

                with open(app_path, 'r', encoding='utf-8') as f:
                    app = json.load(f)

                app['status'] = status
                app['admin_note'] = note
                app['reviewed_at'] = __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

                with open(app_path, 'w', encoding='utf-8') as f:
                    json.dump(app, f, ensure_ascii=False, indent=2)

                self._ok(b'{"ok":true}')
                print(f'[update-application] {app_id} → {status}')

            except Exception as e:
                self._err(e)

        # ── /git-push ──────────────────────────────────────────────────────────
        elif self.path == '/git-push':
            # Return immediately — run git in background thread
            self._ok(b'{"ok":true}')
            def do_push():
                try:
                    def run(*cmd, **kw):
                        return subprocess.run(list(cmd), cwd=BASE, capture_output=True, text=True, **kw)
                    tok = run('/opt/homebrew/bin/gh', 'auth', 'token', timeout=5)
                    token = tok.stdout.strip()
                    run('git', 'add', '-A')
                    status = run('git', 'status', '--porcelain')
                    if status.stdout.strip():
                        run('git', 'commit', '-m', 'Update photos and layout via editor')
                    remote = run('git', 'remote', 'get-url', 'origin').stdout.strip()
                    auth_remote = remote.replace('https://', f'https://yoshino1590012:{token}@')
                    push = run('git', 'push', auth_remote, timeout=60)
                    if push.returncode == 0:
                        print('[git-push] pushed successfully')
                    else:
                        print('[git-push] error:', push.stderr or push.stdout)
                except Exception as e:
                    print(f'[git-push] exception: {e}')
            threading.Thread(target=do_push, daemon=True).start()

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
