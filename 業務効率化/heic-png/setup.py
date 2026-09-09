# -*- coding: utf-8 -*-
"""HEIC を読むための部品(pillow-heif)を入れる。最初の1回だけ実行する。"""
import subprocess
import sys

print("")
print("iPhone の写真(HEIC)を読むための部品を入れます。")
print("インターネットにつながっている必要があります。1〜2分ほどかかります。")
print("")

try:
    import pillow_heif  # noqa
    print("すでに入っていました。このまま 1_おためし.bat が使えます。")
    sys.exit(0)
except ImportError:
    # まだ入っていないだけ。これから入れるので、ここは黙って先へ進んでよい
    pass

r = subprocess.run([sys.executable, "-m", "pip", "install", "pillow-heif==0.18.0"])

if r.returncode != 0:
    print("")
    print("うまく入りませんでした。")
    print("よくある原因: インターネットにつながっていない / 会社のネットで止められている")
    print("この画面をそのまま Claude に見せてください。")
    sys.exit(1)

try:
    import pillow_heif  # noqa
except ImportError:
    print("")
    print("入れたはずの部品が読み込めませんでした。この画面を Claude に見せてください。")
    sys.exit(1)

print("")
print("準備ができました。")
print("次は、写真の入ったフォルダを「1_おためし.bat」の上にドラッグして放してください。")
