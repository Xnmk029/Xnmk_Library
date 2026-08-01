#!/usr/bin/env python3
"""Tiny static server for the THW_CCF2 web app. Usage: py serve.py [port]"""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.mjs': 'text/javascript',
        '.jbeam': 'text/plain', '.dae': 'text/xml', '.dds': 'application/octet-stream',
        '.json': 'application/json',
    }
    def log_message(self, fmt, *args):
        pass

with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    print(f"Serving on http://localhost:{PORT}  (Ctrl+C to stop)")
    httpd.serve_forever()
