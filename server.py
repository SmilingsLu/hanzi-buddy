#!/usr/bin/env python3
"""
Simple HTTP server for Hanzi Buddy that also serves TTS audio.
GET /tts?text=天  → proxies to Baidu TTS and returns MP3 audio
GET /*            → serves static files from current directory
"""
import http.server
import subprocess
import urllib.parse
import urllib.request
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9090

# Baidu TTS endpoint (free, good quality Mandarin)
BAIDU_TTS_URL = 'https://fanyi.baidu.com/gettts?lan=zh&spd=4&source=web&text='


class TTSHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/tts':
            # Extract text parameter
            params = urllib.parse.parse_qs(parsed.query)
            text = params.get('text', [''])[0]
            if not text or len(text) > 50:
                self.send_error(400, 'Missing or too long text parameter')
                return

            try:
                # Fetch from Baidu TTS
                url = BAIDU_TTS_URL + urllib.parse.quote(text)
                req = urllib.request.Request(url, headers={
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://fanyi.baidu.com/'
                })
                with urllib.request.urlopen(req, timeout=10) as resp:
                    audio_data = resp.read()

                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(audio_data)))
                self.send_header('Cache-Control', 'public, max-age=604800')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(audio_data)

            except Exception as e:
                # Fallback to espeak-ng if Baidu fails
                try:
                    result = subprocess.run(
                        ['espeak-ng', '-v', 'zh', '-s', '120', '--stdout', text],
                        capture_output=True, timeout=5
                    )
                    if result.returncode == 0 and result.stdout:
                        self.send_response(200)
                        self.send_header('Content-Type', 'audio/wav')
                        self.send_header('Content-Length', str(len(result.stdout)))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(result.stdout)
                        return
                except Exception:
                    pass
                self.send_error(500, f'TTS failed: {e}')
        else:
            # Serve static files normally
            super().do_GET()

    def log_message(self, format, *args):
        # Only log errors
        if '404' in str(args) or '500' in str(args):
            super().log_message(format, *args)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer(('0.0.0.0', PORT), TTSHandler)
    print(f'🔊 Hanzi Buddy server with TTS at http://localhost:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
