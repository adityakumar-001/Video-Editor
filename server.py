"""Localhost server for MY VIDEO EDITOR. Run: python server.py"""
import http.server, functools, os

PORT = 8000
DIR = os.path.dirname(os.path.abspath(__file__))

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.js': 'text/javascript',
    }
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    print(f"🎬 MY VIDEO EDITOR running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    http.server.ThreadingHTTPServer(
        ('127.0.0.1', PORT),
        functools.partial(H, directory=DIR)
    ).serve_forever()
