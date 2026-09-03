# -*- coding: utf-8 -*-
"""ダウンロードフォルダの画像を、写真倉庫へまとめて移す。"""
import json, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
SETTINGS = os.path.join(HERE, "設定.json")

KIHON = {
    "有効": True,
    "ダウンロード先": "",
    "移動先": "",
    "対象の拡張子": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp",
                     ".heic", ".heif", ".tif", ".tiff", ".avif", ".jfif", ".ico"],
    "書きかけとみなす秒数": 15,
    "日付フォルダを作る": True,
    "日付の決め方": "ファイルの日付",
    "自動で動かす間隔（分）": 5,
}

TASK = "ClaudeDownloadSeiri"          # タスクスケジューラに登録する名前（半角のみ）
LOG = os.path.join(HERE, "自動のきろく.txt")


def yomu():
    s = dict(KIHON)
    if os.path.exists(SETTINGS):
        try:
            with open(SETTINGS, "r", encoding="utf-8") as f:
                s.update(json.load(f))
        except Exception as e:
            print("設定.json が読めませんでした（初期設定で動かします）。")
            print("  理由: %s" % e)
    if not s.get("ダウンロード先"):
        s["ダウンロード先"] = os.path.join(os.path.expanduser("~"), "Downloads")
    if not s.get("移動先"):
        s["移動先"] = os.path.join(os.path.expanduser("~"), "OneDrive", "写真倉庫")
    return s


def kaku(s):
    honbun = json.dumps(s, ensure_ascii=False, indent=2)
    with open(SETTINGS, "w", encoding="utf-8", newline="\n") as f:
        f.write(honbun + "\n")


def jidou_jotai():
    """タスクスケジューラに登録されているか調べる。(登録されているか, 説明)"""
    try:
        r = subprocess.run(["schtasks", "/query", "/tn", TASK],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return (r.returncode == 0, "")
    except Exception as e:
        return (False, "Windowsのタスク一覧を調べられませんでした: %s" % e)


def jidou_on(s):
    pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.exists(pyw):
        pyw = sys.executable
    kankaku = int(s.get("自動で動かす間隔（分）", 5) or 5)
    kankaku = max(1, min(1439, kankaku))
    cmd = '"%s" "%s" --shizuka' % (pyw, os.path.join(HERE, "seiri.py"))
    r = subprocess.run(["schtasks", "/create", "/tn", TASK, "/tr", cmd,
                        "/sc", "minute", "/mo", str(kankaku), "/f"],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        print("  自動で動かす設定に失敗しました。")
        print("  Windowsからの返事: %s"
              % (r.stderr or r.stdout).decode("cp932", "replace").strip())
        return 1
    print("  自動で動かす設定を【オン】にしました。")
    print("  これから %d 分おきに、ダウンロードフォルダの画像を写真倉庫へ移します。" % kankaku)
    print("  画面は出ません。動いた記録は「自動のきろく.txt」に残ります。")
    print("  （パソコンを再起動しても、そのまま続きます）")
    return 0


def jidou_off():
    r = subprocess.run(["schtasks", "/delete", "/tn", TASK, "/f"],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        print("  自動を止める設定に失敗しました。")
        print("  Windowsからの返事: %s"
              % (r.stderr or r.stdout).decode("cp932", "replace").strip())
        return 1
    print("  自動で動かす設定を【オフ】にしました。")
    print("  これからは、自分で「2_まとめて移動.bat」を押したときだけ動きます。")
    return 0


def kiroku(gyou):
    """自動で動いたときの記録を1行残す（画面は出ないので、ここだけが手がかり）。"""
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write("%s  %s\n" % (time.strftime("%Y-%m-%d %H:%M"), gyou))
    except Exception:
        return   # 記録が書けなくても、移動そのものは邪魔しない


def hizuke_folder(s, path):
    """写真倉庫の下に作る「2026-08-26」のような日付フォルダ名を返す。"""
    if not s.get("日付フォルダを作る", True):
        return ""
    if s.get("日付の決め方") == "実行した日":
        t = time.time()
    else:
        try:
            t = os.path.getmtime(path)
        except OSError:
            t = time.time()
    return time.strftime("%Y-%m-%d", time.localtime(t))


def kasanari_yoke(dst_dir, name):
    """同じ名前があったら「名前_2.jpg」のように番号を足す。"""
    moto, ext = os.path.splitext(name)
    kouho = os.path.join(dst_dir, name)
    n = 2
    while os.path.exists(kouho):
        kouho = os.path.join(dst_dir, "%s_%d%s" % (moto, n, ext))
        n += 1
    return kouho


def main():
    otameshi = "--otameshi" in sys.argv
    kirikae = "--kirikae" in sys.argv
    shizuka = "--shizuka" in sys.argv
    s = yomu()

    if shizuka:
        return shizuka_jikkou(s)

    if kirikae:
        print("=" * 56)
        print("  ダウンロード整理  ほうっておいても動く設定（自動）")
        print("=" * 56)
        print()
        ima_on, err = jidou_jotai()
        if err:
            print("  " + err)
            return 1
        print("  いまは【%s】です。" % ("オン" if ima_on else "オフ"))
        print()
        if ima_on:
            return jidou_off()
        return jidou_on(s)

    src = s["ダウンロード先"]
    dst = s["移動先"]
    exts = [e.lower() for e in s["対象の拡張子"]]
    matiaki = float(s.get("書きかけとみなす秒数", 15))

    print("=" * 52)
    print("  ダウンロード整理" + ("（おためし・移動しません）" if otameshi else ""))
    print("=" * 52)
    print()
    print("  さがす場所 : %s" % src)
    print("  移す先     : %s" % dst)
    jidou, _e = jidou_jotai()
    print("  自動       : %s（%s）" % ("オン" if jidou else "オフ",
          "ほうっておいても %d 分おきに動きます" % int(s.get("自動で動かす間隔（分）", 5) or 5)
          if jidou else "いまは押したときだけ動きます"))
    if not s.get("有効", True):
        print("  一時停止中 : 設定.json の「有効」が false です")
    if s.get("日付フォルダを作る", True):
        moto = "実行した日" if s.get("日付の決め方") == "実行した日" else "画像の日付"
        print("  仕分け     : %s ごとのフォルダを作って入れます（例 2026-08-26）" % moto)
    else:
        print("  仕分け     : 日付フォルダは作りません")
    print()

    if not s.get("有効", True) and not otameshi:
        print("  いまスイッチが【オフ】なので、何も移動しませんでした。")
        print("  動かしたいときは「3_オンオフ切替.bat」を押してオンにしてください。")
        return 0

    if not os.path.isdir(src):
        print("  ダウンロードフォルダが見つかりませんでした。")
        print("  場所: %s" % src)
        print("  設定.json の「ダウンロード先」に正しい場所を書いてください。")
        return 1

    ima = time.time()
    taisyou = []
    kakikake = 0
    for name in sorted(os.listdir(src)):
        p = os.path.join(src, name)
        if not os.path.isfile(p):
            continue
        if os.path.splitext(name)[1].lower() not in exts:
            continue
        try:
            if ima - os.path.getmtime(p) < matiaki:
                kakikake += 1
                continue
        except OSError:
            continue
        taisyou.append(name)

    if not taisyou:
        print("  移せる画像は1枚もありませんでした。")
        if kakikake:
            print("  （ダウンロードの途中らしい画像が %d 枚あったので、よけました）" % kakikake)
        return 0

    print("  見つかった画像: %d 枚" % len(taisyou))
    if kakikake:
        print("  ダウンロード途中らしく、よけたもの: %d 枚" % kakikake)
    print()

    if otameshi:
        for name in taisyou[:20]:
            hi = hizuke_folder(s, os.path.join(src, name))
            print("    ・%s   → %s" % (name, hi + "\\" if hi else "写真倉庫の直下"))
        if len(taisyou) > 20:
            print("    ほか %d 枚" % (len(taisyou) - 20))
        print()
        print("  おためしなので、まだ1枚も動かしていません。")
        print("  よければ「2_まとめて移動.bat」を押してください。")
        return 0

    ok = 0
    ng = []
    tsukutta = {}
    for name in taisyou:
        moto = os.path.join(src, name)
        hi = hizuke_folder(s, moto)
        sakidir = os.path.join(dst, hi) if hi else dst
        try:
            os.makedirs(sakidir, exist_ok=True)
        except Exception as e:
            ng.append((name, "フォルダを作れませんでした: %s" % e))
            continue
        saki = kasanari_yoke(sakidir, name)
        try:
            shutil.move(moto, saki)
            ok += 1
            tsukutta[hi] = tsukutta.get(hi, 0) + 1
        except Exception as e:
            ng.append((name, str(e)))

    print("  %d 枚を写真倉庫へ移しました。" % ok)
    for hi in sorted(tsukutta):
        print("    %s : %d 枚" % (hi if hi else "（写真倉庫の直下）", tsukutta[hi]))
    if ng:
        print()
        print("  移せなかったものが %d 枚あります:" % len(ng))
        for name, riyuu in ng[:10]:
            print("    ・%s" % name)
            print("       理由: %s" % riyuu)
        print("  （他のソフトで開いたままだと移せません。閉じてもう一度お試しください）")
    return 0


def shizuka_jikkou(s):
    """画面を出さずに移動する（タスクスケジューラから呼ばれる用）。"""
    src = s["ダウンロード先"]
    dst = s["移動先"]
    if not s.get("有効", True):
        return 0
    if not os.path.isdir(src):
        kiroku("ダウンロードフォルダが見つかりません: %s" % src)
        return 1
    exts = [e.lower() for e in s["対象の拡張子"]]
    matiaki = float(s.get("書きかけとみなす秒数", 15))
    ima = time.time()
    ok = 0
    shippai = 0
    for name in sorted(os.listdir(src)):
        p = os.path.join(src, name)
        if not os.path.isfile(p):
            continue
        if os.path.splitext(name)[1].lower() not in exts:
            continue
        try:
            if ima - os.path.getmtime(p) < matiaki:
                continue
        except OSError:
            continue
        hi = hizuke_folder(s, p)
        sakidir = os.path.join(dst, hi) if hi else dst
        try:
            os.makedirs(sakidir, exist_ok=True)
            shutil.move(p, kasanari_yoke(sakidir, name))
            ok += 1
        except Exception:
            shippai += 1     # 開いたままのファイルなど。次回また試す
    if ok or shippai:
        kiroku("%d 枚を移しました（移せなかったもの %d 枚）" % (ok, shippai))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print()
        print("  思わぬところで止まってしまいました。")
        print("  内容: %s" % e)
        sys.exit(1)
