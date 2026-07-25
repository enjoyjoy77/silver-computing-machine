# -*- coding: utf-8 -*-
"""深度GPU: 画像から高品質な深度マップを作る(Depth Anything 3 / DA3MONO-LARGE)

使い方: 「入れる」フォルダに画像を置いて 1_深度をつくる.bat をダブルクリック。
出来上がり\ に 元画像のコピー + <名前>_depth.png ができる。
2つを「覗ける標本(3Dラック)」の手動選択で読み込むと高品質版で覗ける。
"""
import os
import sys
import time
import traceback

BASE = os.path.dirname(os.path.abspath(__file__))
IN_DIR = os.path.join(BASE, "入れる")
OUT_DIR = os.path.join(BASE, "出来上がり")
MODEL_ID = "depth-anything/DA3MONO-LARGE"   # Apache-2.0(公開サイトでも安心)
EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")


def say(msg):
    print(msg, flush=True)


def main():
    os.makedirs(IN_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    files = [f for f in sorted(os.listdir(IN_DIR))
             if f.lower().endswith(EXTS) and not f.startswith(".")]
    if not files:
        say("「入れる」フォルダに画像がありません。")
        say("写真(jpg/png)を入れてから、もう一度ダブルクリックしてください。")
        return 1

    # おためしモード: 引数 --otameshi なら最初の1枚だけ
    otameshi = "--otameshi" in sys.argv
    if otameshi:
        files = files[:1]
        say("[おためし] 最初の1枚だけ処理します")

    say(f"画像 {len(files)} 枚を処理します。")
    say("AIモデルを準備しています…(初回はダウンロードで数分かかります)")

    import numpy as np
    import torch
    from PIL import Image

    if not torch.cuda.is_available():
        say("")
        say("[!] GPU(CUDA)が見つかりません。CPUで動かすと非常に遅いため中止します。")
        say("    グラフィックドライバの更新後にもう一度お試しください。")
        return 1

    from depth_anything_3.api import DepthAnything3
    t0 = time.time()
    model = DepthAnything3.from_pretrained(MODEL_ID)
    model = model.to("cuda")
    say(f"モデル準備OK({time.time()-t0:.0f}秒)。深度を作ります。")

    done = 0
    for i, name in enumerate(files, 1):
        src = os.path.join(IN_DIR, name)
        stem = os.path.splitext(name)[0]
        out_depth = os.path.join(OUT_DIR, stem + "_depth.png")
        out_src = os.path.join(OUT_DIR, name)

        if os.path.exists(out_depth):
            say(f"[{i}/{len(files)}] {name} → 済み(前回作成)。飛ばします")
            done += 1
            continue

        try:
            t1 = time.time()
            prediction = model.inference([src])
            depth = np.asarray(prediction.depth, dtype=np.float32)
            if depth.ndim == 3:
                depth = depth[0]

            # DA3は「距離」(奥ほど大きい)を返す。そのまま使うと人物と背景の
            # 距離差が支配して人物内の凹凸がぺったんこになる(実機で発生)。
            # ブラウザ版AIと同じ「視差=1/距離」(近い所の差ほど大きく出る)に
            # 変換してから、2〜98%の範囲で0-255に伸ばす(手前=白は自動で成立)
            disp = 1.0 / np.maximum(depth, 1e-6)
            lo, hi = np.percentile(disp, [2, 98])
            if hi - lo < 1e-9:
                raise RuntimeError("深度が平坦です(画像が真っ白/真っ黒でないか確認)")
            norm = np.clip((disp - lo) / (hi - lo), 0, 1)
            # ソフトニー: 階調の大半が「人物と背景の段差」に食われて人物内の
            # 凹凸がぺったんこになるのを防ぐ(下半分=主に背景を0-0.25に圧縮、
            # 上半分=人物内を0.25-1.0へ1.5倍に拡大。実機の「ぺったんこ」対策)
            norm = np.where(norm < 0.5, norm * 0.5,
                            0.25 + (norm - 0.5) * 1.5)
            gray = (norm * 255.0).round().astype(np.uint8)

            img = Image.open(src)
            depth_img = Image.fromarray(gray, mode="L").resize(
                img.size, Image.BILINEAR)
            depth_img.save(out_depth)
            img.convert("RGB").save(out_src, quality=95) \
                if out_src.lower().endswith((".jpg", ".jpeg")) \
                else img.save(out_src)
            done += 1
            say(f"[{i}/{len(files)}] {name} → 深度OK({time.time()-t1:.1f}秒)")
        except Exception as e:
            say(f"[{i}/{len(files)}] {name} → 失敗: {e}")
            say("    (この1枚だけ飛ばして続けます)")

    say("")
    if done:
        say(f"完了: {done}/{len(files)} 枚。「出来上がり」フォルダを見てください。")
        say("覗き方: 3Dラック(hyohon)の手動選択で、元画像と_depth.pngの2つを選ぶ")
    else:
        say("1枚もできませんでした。上のメッセージを確認してください。")
    return 0 if done else 1


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        say("")
        say("[!] 予期しないエラーで止まりました:")
        traceback.print_exc()
        code = 1
    say("")
    input("Enterキーで閉じます...")
    sys.exit(code)
