# -*- coding: utf-8 -*-
"""iPhone の写真(.heic/.heif)を PNG に変換する。

使い方(bat から呼ばれる):
    python henkan.py [--otameshi] <フォルダ or ファイル> ...

出力は、元の写真と同じ場所の「PNG」フォルダの中。元の写真は消さない。
画像の中身は画面に出さない(変換するだけ)。
"""
import sys
import os

def annai(s):
    print(s, flush=True)


def atsumeru(paths):
    """渡されたパスから、変換対象の HEIC ファイル一覧を作る。"""
    shashin = []
    for p in paths:
        if os.path.isdir(p):
            for name in sorted(os.listdir(p)):
                full = os.path.join(p, name)
                if os.path.isfile(full) and name.lower().endswith((".heic", ".heif")):
                    shashin.append(full)
        elif os.path.isfile(p) and p.lower().endswith((".heic", ".heif")):
            shashin.append(p)
    return shashin


def kaburanai_namae(dest_dir, base):
    """保存先の PNG の場所を返す。すでに有れば None(=やり直しても増えない)。"""
    kouho = os.path.join(dest_dir, base + ".png")
    if os.path.exists(kouho):
        return None
    return kouho


def folder_erabu():
    """フォルダを選ぶ窓を出す。閉じられた・窓が出せないときは空文字。"""
    try:
        import tkinter
        from tkinter import filedialog
    except ImportError:
        return ""
    try:
        root = tkinter.Tk()
        root.withdraw()
        d = filedialog.askdirectory(title="iPhone の写真が入っているフォルダを選んでください")
        root.destroy()
        return d or ""
    except Exception:
        return ""


def main():
    args = [a for a in sys.argv[1:]]
    otameshi = "--otameshi" in args
    paths = [a for a in args if not a.startswith("--")]

    if not paths:
        # ドラッグ＆ドロップされずに起動したとき(ツールメニューからなど)は、
        # フォルダを選ぶ窓を出す
        erabareta = folder_erabu()
        if erabareta:
            paths = [erabareta]
        else:
            annai("")
            annai("写真が渡されていません。")
            annai("")
            annai("iPhone の写真が入っているフォルダ(または写真そのもの)を、")
            annai("この bat ファイルの上にドラッグ＆ドロップして放してください。")
            return 1

    try:
        import pillow_heif
        from PIL import Image, ImageOps
    except ImportError:
        annai("")
        annai("HEIC を読むための部品が入っていません。")
        annai("先に「0_さいしょに1回だけ.bat」をダブルクリックしてください。")
        annai("(インターネットにつないだ状態で、1回だけ必要です)")
        return 1

    pillow_heif.register_heif_opener()

    shashin = atsumeru(paths)
    if not shashin:
        annai("")
        annai("iPhone の写真(.heic)が1枚も見つかりませんでした。")
        annai("渡したもの:")
        for p in paths:
            annai("  " + p)
        annai("")
        annai("※ すでに .jpg や .png になっている写真は、変換する必要がありません。")
        return 1

    if otameshi:
        annai("【おためし】1枚だけ変換します。(全部やるときは 2_ぜんぶ変換.bat)")
        shashin = shashin[:1]

    annai("")
    annai("%d 枚を PNG にします。" % len(shashin))
    annai("")

    seikou = 0
    tobashita = 0
    shippai = []
    for i, src in enumerate(shashin, 1):
        dest_dir = os.path.join(os.path.dirname(src), "PNG")
        base = os.path.splitext(os.path.basename(src))[0]
        try:
            os.makedirs(dest_dir, exist_ok=True)
            out = kaburanai_namae(dest_dir, base)
            if out is None:
                tobashita += 1
                annai("  (%d/%d) %s … もう有るので飛ばしました" %
                      (i, len(shashin), os.path.basename(src)))
                continue
            with Image.open(src) as im:
                # iPhone の写真は「向き」の情報を別に持っているので、
                # ここで実際に回してから保存する(横倒し防止)
                im = ImageOps.exif_transpose(im)
                im.save(out, "PNG")
            seikou += 1
            annai("  (%d/%d) %s → %s" % (i, len(shashin), os.path.basename(src),
                                          os.path.basename(out)))
        except Exception as e:
            shippai.append((src, str(e)))
            annai("  (%d/%d) %s … 失敗" % (i, len(shashin), os.path.basename(src)))

    annai("")
    annai("できました: %d 枚" % seikou)
    if tobashita:
        annai("すでに PNG が有ったので飛ばしたもの: %d 枚" % tobashita)
    if seikou or tobashita:
        annai("保存先: 写真と同じ場所の「PNG」フォルダの中")
    if shippai:
        annai("")
        annai("うまくいかなかったもの: %d 枚" % len(shippai))
        for src, e in shippai:
            annai("  %s" % os.path.basename(src))
            annai("    理由: %s" % e)
        annai("")
        annai("この画面をそのまま Claude に見せると、原因を調べられます。")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
