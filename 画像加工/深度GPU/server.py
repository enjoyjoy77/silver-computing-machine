# -*- coding: utf-8 -*-
"""深度GPUサーバー: 画像工房をこのPCから配信し、GPU深度APIを足す

2_gpu_site.bat で起動。ブラウザで http://localhost:8977/depth.html を開くと、
depth.html に「⚡ PCのGPU(高画質)」モードが自動で現れる。
同じWi-Fiのスマホからは、起動時に表示されるLAN側のURLで開ける。
"""
import io
import os
import socket
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.normpath(os.path.join(BASE, "..", "画像工房"))
PORT = 8977
MODEL_ID = "depth-anything/DA3MONO-LARGE"

_model = None
_model_lock = threading.Lock()


def say(msg):
    print(msg, flush=True)


def get_model():
    global _model
    with _model_lock:
        if _model is None:
            say("AIモデルを読み込んでいます…(初回は1〜3分)")
            t0 = time.time()
            from depth_anything_3.api import DepthAnything3
            m = DepthAnything3.from_pretrained(MODEL_ID)
            _model = m.to("cuda")
            say(f"モデル準備OK({time.time()-t0:.0f}秒)")
        return _model


def make_depth_png(image_bytes):
    import numpy as np
    from PIL import Image

    src = Image.open(io.BytesIO(image_bytes))
    src_size = src.size

    tmp = os.path.join(BASE, f"_srv_{threading.get_ident()}.png")
    src.convert("RGB").save(tmp)
    try:
        prediction = get_model().inference([tmp])
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass   # 一時ファイルの掃除失敗は結果に影響しないので握る(意図的)

    depth = np.asarray(prediction.depth, dtype=np.float32)
    if depth.ndim == 3:
        depth = depth[0]
    lo, hi = np.percentile(depth, [2, 98])
    if hi - lo < 1e-9:
        raise RuntimeError("深度が平坦です")
    norm = np.clip((depth - lo) / (hi - lo), 0, 1)
    gray = ((1.0 - norm) * 255.0).round().astype("uint8")

    out = Image.fromarray(gray, mode="L").resize(src_size, Image.BILINEAR)
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


MIME = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript",
    ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".wasm": "application/wasm", ".tflite": "application/octet-stream",
    ".task": "application/octet-stream", ".splat": "application/octet-stream",
    ".ply": "application/octet-stream",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/gpu/ping":
            return self._send(200, b'{"ok":true,"model":"DA3MONO-LARGE"}')

        rel = path.lstrip("/") or "index.html"
        # URLエンコードされた日本語パスに対応
        from urllib.parse import unquote
        rel = unquote(rel)
        full = os.path.normpath(os.path.join(SITE_DIR, rel))
        if not full.startswith(SITE_DIR) or not os.path.isfile(full):
            return self._send(404, b"not found", "text/plain")
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            self._send(200, f.read(), MIME.get(ext, "application/octet-stream"))

    def do_POST(self):
        if self.path.split("?")[0] != "/api/gpu/depth":
            return self._send(404, b"not found", "text/plain")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 60 * 1024 * 1024:
                return self._send(400, b"bad size", "text/plain")
            data = self.rfile.read(n)
            t0 = time.time()
            png = make_depth_png(data)
            say(f"深度OK ({len(data)//1024}KB → {time.time()-t0:.1f}秒)")
            return self._send(200, png, "image/png")
        except Exception as e:
            say("深度の生成に失敗:")
            traceback.print_exc()
            msg = ("深度の生成に失敗しました: " + str(e)).encode("utf-8")
            return self._send(500, msg, "text/plain; charset=utf-8")


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main():
    if not os.path.isdir(SITE_DIR):
        say(f"[!] 画像工房フォルダが見つかりません: {SITE_DIR}")
        return 1
    import torch
    if not torch.cuda.is_available():
        say("[!] GPU(CUDA)が見つかりません。中止します。")
        return 1

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    say("")
    say("=== 深度GPUサーバー起動 ===")
    say(f"このPCで開く:   http://localhost:{PORT}/depth.html")
    ip = lan_ip()
    if ip:
        say(f"スマホで開く:   http://{ip}:{PORT}/depth.html  (同じWi-Fiのみ)")
    say("")
    say("最初の1枚のときにAIモデルを読み込みます(1〜3分)。2枚目からは数秒です。")
    say("終わるときは、この窓を閉じてください。")
    say("")
    server.serve_forever()


if __name__ == "__main__":
    try:
        code = main()
    except KeyboardInterrupt:
        code = 0
    except Exception:
        traceback.print_exc()
        input("Enterキーで閉じます...")
        code = 1
    raise SystemExit(code or 0)
