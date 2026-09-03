# -*- coding: utf-8 -*-
"""指定したフォルダの中身を、日付ごとのフォルダに分ける（種類は問わない）。"""
import json, os, shutil, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
SETTINGS = os.path.join(HERE, "設定.json")

KIHON = {
    "日付の決め方": "更新した日",   # または "作った日"
    "分け方": "日",                 # "日" = 2026-08-26 / "月" = 2026-08 / "年" = 2026
    "この種類だけ分ける": [],       # 例 [".jpg", ".png"]。空っぽなら全部
    "この種類は分けない": [".lnk", ".ini", ".tmp", ".crdownload", ".part"],
    "書きかけとみなす秒数": 15,
}


def yomu():
    s = dict(KIHON)
    if os.path.exists(SETTINGS):
        try:
            with open(SETTINGS, "r", encoding="utf-8") as f:
                s.update(json.load(f))
        except Exception as e:
            print("  設定.json が読めませんでした（初期設定で動かします）。")
            print("  理由: %s" % e)
    return s


def folder_erabu():
    """引数が無いときにフォルダを選ぶ窓を出す。"""
    try:
        import tkinter
        from tkinter import filedialog
        root = tkinter.Tk()
        root.withdraw()
        p = filedialog.askdirectory(title="日付ごとに分けたいフォルダを選んでください")
        root.destroy()
        return p
    except Exception:
        return ""


def hizuke_mei(s, path):
    if s.get("日付の決め方") == "作った日":
        t = os.path.getctime(path)
    else:
        t = os.path.getmtime(path)
    katachi = {"年": "%Y", "月": "%Y-%m"}.get(s.get("分け方", "日"), "%Y-%m-%d")
    return time.strftime(katachi, time.localtime(t))


def kasanari_yoke(dst_dir, name):
    moto, ext = os.path.splitext(name)
    kouho = os.path.join(dst_dir, name)
    n = 2
    while os.path.exists(kouho):
        kouho = os.path.join(dst_dir, "%s_%d%s" % (moto, n, ext))
        n += 1
    return kouho


def main():
    hikisu = [a for a in sys.argv[1:] if not a.startswith("--")]
    otameshi = "--otameshi" in sys.argv
    s = yomu()

    print("=" * 56)
    print("  日付でわける" + ("（おためし・動かしません）" if otameshi else ""))
    print("=" * 56)
    print()

    target = hikisu[0] if hikisu else folder_erabu()
    if not target:
        print("  フォルダが指定されませんでした。")
        print("  このファイルの上に、分けたいフォルダをドラッグして落としてください。")
        return 1
    target = os.path.abspath(target)
    if not os.path.isdir(target):
        print("  フォルダではないものが渡されました。")
        print("  渡されたもの: %s" % target)
        print("  ファイルではなく「フォルダ」をドラッグしてください。")
        return 1

    tan = {"年": "年ごと", "月": "月ごと"}.get(s.get("分け方", "日"), "日ごと")
    print("  分けるフォルダ : %s" % target)
    print("  分け方         : %s（%s のフォルダをこの中に作ります）"
          % (tan, {"年": "2026", "月": "2026-08"}.get(s.get("分け方", "日"), "2026-08-26")))
    print("  日付の元       : ファイルを%s" % s.get("日付の決め方", "更新した日"))
    print()

    dake = [e.lower() for e in s.get("この種類だけ分ける") or []]
    nashi = [e.lower() for e in s.get("この種類は分けない") or []]
    matiaki = float(s.get("書きかけとみなす秒数", 15))
    ima = time.time()

    taisyou = []
    yoketa = 0
    for name in sorted(os.listdir(target)):
        p = os.path.join(target, name)
        if not os.path.isfile(p):
            continue          # フォルダはそのまま。中身も触りません
        ext = os.path.splitext(name)[1].lower()
        if dake and ext not in dake:
            continue
        if ext in nashi:
            continue
        try:
            if ima - os.path.getmtime(p) < matiaki:
                yoketa += 1
                continue
        except OSError:
            continue
        taisyou.append(name)

    if not taisyou:
        print("  分けられるファイルは1つもありませんでした。")
        if yoketa:
            print("  （たった今できたばかりのファイルが %d 個あったので、よけました）" % yoketa)
        print("  ※ フォルダの中のフォルダは触りません。直下のファイルだけを分けます。")
        return 0

    print("  見つかったファイル: %d 個" % len(taisyou))
    if yoketa:
        print("  できたばかりでよけたもの: %d 個" % yoketa)
    print()

    kazu = {}
    yomenai = 0
    for name in taisyou:
        try:
            hi = hizuke_mei(s, os.path.join(target, name))
        except OSError:
            yomenai += 1   # 日付が読めないものは数に入れない
            continue
        kazu[hi] = kazu.get(hi, 0) + 1
    if yomenai:
        print("  日付が読めないファイル: %d 個（そのまま置いておきます）" % yomenai)

    if otameshi:
        for hi in sorted(kazu):
            print("    %s  … %d 個" % (hi, kazu[hi]))
        print()
        print("  つまり %d 個のフォルダに分かれます。" % len(kazu))
        print("  おためしなので、まだ1つも動かしていません。")
        print("  よければ「2_本番_ここにフォルダをドラッグ.bat」に同じフォルダを落としてください。")
        return 0

    ok = 0
    ng = []
    kekka = {}
    for name in taisyou:
        moto = os.path.join(target, name)
        try:
            hi = hizuke_mei(s, moto)
        except OSError as e:
            ng.append((name, "日付が読めませんでした: %s" % e))
            continue
        sakidir = os.path.join(target, hi)
        try:
            os.makedirs(sakidir, exist_ok=True)
        except Exception as e:
            ng.append((name, "フォルダを作れませんでした: %s" % e))
            continue
        try:
            shutil.move(moto, kasanari_yoke(sakidir, name))
            ok += 1
            kekka[hi] = kekka.get(hi, 0) + 1
        except Exception as e:
            ng.append((name, str(e)))

    print("  %d 個を %d 個の日付フォルダに分けました。" % (ok, len(kekka)))
    for hi in sorted(kekka):
        print("    %s : %d 個" % (hi, kekka[hi]))
    if ng:
        print()
        print("  分けられなかったものが %d 個あります:" % len(ng))
        for name, riyuu in ng[:10]:
            print("    ・%s" % name)
            print("       理由: %s" % riyuu)
        print("  （他のソフトで開いたままだと動かせません。閉じてもう一度お試しください）")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print()
        print("  思わぬところで止まってしまいました。")
        print("  内容: %s" % e)
        sys.exit(1)
