from __future__ import annotations

import argparse
import base64
import hashlib
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


PBKDF2_ITER = 300000
FIXED_SALT = "filesync-angou-v1"
MAGIC = "MSENC1"
CODE_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"

CONFIG_FILENAME = "config.json"
HTTP_TIMEOUT_SECONDS = 10
CLAUDE_TIMEOUT_SECONDS = 180

SAMPLE_CONFIG = {
    "site_base_url": "https://silver-computing-machine-7ql.pages.dev",
    "question_passphrase": "ここに質問用の合言葉（10文字程度）",
    "answer_passphrase": "ここに回答用の合言葉（質問用と別のもの）",
    "poll_interval_seconds": 3,
    "claude_command": "claude",
    "claude_args": ["-p"],
    "log_file": "relay_log.txt",
}


class RelayError(Exception):
    pass


def script_directory() -> Path:
    return Path(__file__).resolve().parent


def format_time() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def write_log(log_path: Path, message: str) -> None:
    line = f"[{format_time()}] {message}"
    print(line, flush=True)

    try:
        with log_path.open("a", encoding="utf-8", newline="\n") as file:
            file.write(line + "\n")
    except Exception as error:
        print(
            f"[{format_time()}] ログファイルへの書き込みに失敗しました: {error}",
            file=sys.stderr,
            flush=True,
        )


def create_sample_config(config_path: Path) -> None:
    text = json.dumps(SAMPLE_CONFIG, ensure_ascii=False, indent=2) + "\n"
    config_path.write_text(text, encoding="utf-8")


def load_config(config_path: Path) -> dict[str, Any]:
    if not config_path.exists():
        try:
            create_sample_config(config_path)
        except Exception as error:
            raise RelayError(
                f"設定ファイルがありません。また、ひな形の作成にも失敗しました: {error}"
            ) from error

        raise RelayError(
            f"設定ファイルがなかったため、ひな形を作成しました。\n"
            f"{config_path}\n"
            "質問用と回答用の合言葉を設定してから、もう一度起動してください。"
        )

    try:
        with config_path.open("r", encoding="utf-8-sig") as file:
            config = json.load(file)
    except UnicodeDecodeError as error:
        raise RelayError(
            "config.jsonをUTF-8として読み取れませんでした。"
        ) from error
    except json.JSONDecodeError as error:
        raise RelayError(
            f"config.jsonのJSON形式が正しくありません "
            f"（{error.lineno}行目、{error.colno}文字目）。"
        ) from error
    except OSError as error:
        raise RelayError(f"config.jsonを読み取れませんでした: {error}") from error

    if not isinstance(config, dict):
        raise RelayError("config.jsonの一番外側はJSONオブジェクトにしてください。")

    required_string_keys = (
        "site_base_url",
        "question_passphrase",
        "answer_passphrase",
        "claude_command",
        "log_file",
    )

    for key in required_string_keys:
        value = config.get(key)
        if not isinstance(value, str) or not value.strip():
            raise RelayError(
                f"config.jsonの「{key}」には空でない文字列を設定してください。"
            )

    claude_args = config.get("claude_args")
    if (
        not isinstance(claude_args, list)
        or not all(isinstance(item, str) for item in claude_args)
    ):
        raise RelayError(
            "config.jsonの「claude_args」は文字列の配列にしてください。"
        )

    poll_interval = config.get("poll_interval_seconds")
    if (
        isinstance(poll_interval, bool)
        or not isinstance(poll_interval, (int, float))
        or poll_interval <= 0
    ):
        raise RelayError(
            "config.jsonの「poll_interval_seconds」は0より大きい数にしてください。"
        )

    base_url = config["site_base_url"].strip().rstrip("/")
    parsed_url = urllib.parse.urlsplit(base_url)

    if (
        parsed_url.scheme not in ("http", "https")
        or not parsed_url.netloc
        or parsed_url.query
        or parsed_url.fragment
    ):
        raise RelayError(
            "config.jsonの「site_base_url」にはhttpまたはhttpsのURLを設定してください。"
        )

    config["site_base_url"] = base_url
    config["question_passphrase"] = config["question_passphrase"].strip()
    config["answer_passphrase"] = config["answer_passphrase"].strip()
    config["claude_command"] = config["claude_command"].strip()
    config["log_file"] = config["log_file"].strip()
    config["poll_interval_seconds"] = float(poll_interval)

    return config


def derive_locker_code(passphrase: str) -> str:
    source = (
        "memo-locker:" + FIXED_SALT + ":" + passphrase
    ).encode("utf-8")
    digest = hashlib.sha256(source).digest()

    return "".join(
        CODE_ALPHABET[byte % len(CODE_ALPHABET)]
        for byte in digest[:6]
    )


def derive_aes_key(passphrase: str) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=("memo-key:" + FIXED_SALT).encode("utf-8"),
        iterations=PBKDF2_ITER,
    )
    return kdf.derive(passphrase.encode("utf-8"))


def encrypt_text(text: str, key: bytes) -> str:
    iv = __import__("os").urandom(12)
    cipher_text = AESGCM(key).encrypt(
        iv,
        text.encode("utf-8"),
        None,
    )
    encoded = base64.b64encode(iv + cipher_text).decode("ascii")
    return MAGIC + encoded


def decrypt_text(payload: str, key: bytes) -> str:
    if not payload.startswith(MAGIC):
        raise RelayError("暗号化されていないデータです。")

    encoded = payload[len(MAGIC):]

    try:
        encrypted = base64.b64decode(encoded, validate=True)
    except Exception as error:
        raise RelayError("暗号データのBase64形式が壊れています。") from error

    if len(encrypted) < 12 + 17:
        raise RelayError("暗号データが短すぎるため、壊れている可能性があります。")

    iv = encrypted[:12]
    cipher_text = encrypted[12:]

    try:
        plain_text = AESGCM(key).decrypt(iv, cipher_text, None)
    except Exception as error:
        raise RelayError(
            "質問を復号できませんでした。合言葉が違う可能性があります。"
        ) from error

    try:
        return plain_text.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RelayError(
            "復号後の質問をUTF-8として読み取れませんでした。"
        ) from error


def read_error_body(error: urllib.error.HTTPError) -> str:
    try:
        body = error.read().decode("utf-8", errors="replace").strip()
    except Exception:
        return ""

    if not body:
        return ""

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return body[:500]

    if isinstance(data, dict):
        message = data.get("message")
        if isinstance(message, str) and message:
            return message

        error_code = data.get("error")
        if isinstance(error_code, str) and error_code:
            return error_code

    return body[:500]


def request_json(
    url: str,
    method: str,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
) -> dict[str, Any]:
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "relay.py/1",
    }

    if headers:
        request_headers.update(headers)

    request = urllib.request.Request(
        url=url,
        data=body,
        headers=request_headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=HTTP_TIMEOUT_SECONDS,
        ) as response:
            response_body = response.read()
    except urllib.error.HTTPError as error:
        detail = read_error_body(error)
        message = f"サーバーがHTTP {error.code}を返しました。"
        if detail:
            message += f" {detail}"
        raise RelayError(message) from error
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", error)
        raise RelayError(f"サーバーと通信できませんでした: {reason}") from error
    except TimeoutError as error:
        raise RelayError("サーバーとの通信がタイムアウトしました。") from error
    except OSError as error:
        raise RelayError(f"通信中にエラーが発生しました: {error}") from error

    try:
        data = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RelayError(
            "サーバーから正しいJSON応答を受け取れませんでした。"
        ) from error

    if not isinstance(data, dict):
        raise RelayError("サーバーのJSON応答が正しい形式ではありません。")

    if data.get("ok") is not True:
        message = data.get("message")
        if not isinstance(message, str) or not message:
            message = "サーバーが処理の失敗を返しました。"
        raise RelayError(message)

    return data


def memo_url(site_base_url: str, locker_code: str) -> str:
    quoted_code = urllib.parse.quote(locker_code, safe="")
    return f"{site_base_url}/api/memo/{quoted_code}"


def get_memo(site_base_url: str, locker_code: str) -> dict[str, Any]:
    return request_json(
        memo_url(site_base_url, locker_code),
        method="GET",
    )


def put_memo(
    site_base_url: str,
    locker_code: str,
    payload: str,
) -> dict[str, Any]:
    return request_json(
        memo_url(site_base_url, locker_code),
        method="PUT",
        headers={
            "Content-Type": "text/plain; charset=utf-8",
            "Origin": site_base_url,
        },
        body=payload.encode("utf-8"),
    )


# claude.exe はデスクトップアプリに同梱されており、PATHには載っていない。
# 置き場所がバージョン番号付きフォルダなので、アプリ更新で番号が変わっても
# 動くように「一番新しいフォルダ」を自動で探す。
CLAUDE_SEARCH_DIRS = (
    Path.home() / "AppData" / "Roaming" / "Claude" / "claude-code",
    Path.home()
    / "AppData"
    / "Local"
    / "Packages"
    / "Claude_pzs8sxrjxfjjc"
    / "LocalCache"
    / "Roaming"
    / "Claude"
    / "claude-code",
)


def version_sort_key(name: str) -> tuple:
    # "2.1.219" のような版番号を数値として比べる(文字列比較だと 2.1.9 > 2.1.219 になる)
    parts = []
    for piece in name.split("."):
        parts.append(int(piece) if piece.isdigit() else -1)
    return tuple(parts)


def find_claude_executable() -> str | None:
    candidates = []

    for base in CLAUDE_SEARCH_DIRS:
        if not base.is_dir():
            continue

        for child in base.iterdir():
            exe = child / "claude.exe"
            if child.is_dir() and exe.is_file():
                candidates.append((version_sort_key(child.name), str(exe)))

    if not candidates:
        return None

    candidates.sort()
    return candidates[-1][1]


def resolve_claude_command(command: str, log_path: Path) -> str:
    # config.jsonが "claude" / "auto" のときだけ自動で探す。
    # 明示的にフルパスを書いた場合はそれを尊重する。
    if command.lower() not in ("claude", "claude.exe", "auto"):
        return command

    found = find_claude_executable()

    if found:
        write_log(log_path, f"claude.exeを自動で見つけました: {found}")
        return found

    write_log(
        log_path,
        "claude.exeを自動で見つけられませんでした。"
        "config.jsonのclaude_commandにフルパスを書いてください。",
    )
    return command


def check_claude_login(command: str, log_path: Path) -> bool:
    # claude.exe はデスクトップアプリとは別にログインが要る。
    # 未ログインのまま動かすと、質問が来るたびに黙って失敗するので起動時に確認する。
    try:
        result = subprocess.run(
            [command, "auth", "status"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
            check=False,
        )
    except Exception as error:
        write_log(
            log_path,
            f"claudeのログイン状態を確認できませんでした: {error}",
        )
        return False

    try:
        status = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        write_log(log_path, "claudeのログイン状態の応答を読み取れませんでした。")
        return False

    if status.get("loggedIn") is True:
        write_log(log_path, "claudeはログイン済みです。")
        return True

    write_log(
        log_path,
        "【重要】claudeが未ログインです。このままでは回答が返りません。"
        "コマンドプロンプトで claude auth login を1回実行してください。",
    )
    return False


def run_claude(
    command: str,
    arguments: list[str],
    question: str,
) -> str:
    full_command = [command] + arguments + [question]

    try:
        result = subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=CLAUDE_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise RelayError(
            f"Claudeの呼び出しが{CLAUDE_TIMEOUT_SECONDS}秒でタイムアウトしました。"
        ) from error
    except FileNotFoundError as error:
        raise RelayError(
            f"Claudeコマンド「{command}」が見つかりません。"
        ) from error
    except OSError as error:
        raise RelayError(f"Claudeを起動できませんでした: {error}") from error

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        detail = f" stderr={stderr}" if stderr else ""
        raise RelayError(
            f"Claudeの呼び出しに失敗しました "
            f"（returncode={result.returncode}）。{detail}"
        )

    answer = result.stdout or ""

    if not answer.strip():
        raise RelayError("Claudeから空の回答が返されました。")

    return answer


def process_poll(
    config: dict[str, Any],
    question_code: str,
    question_key: bytes,
    answer_code: str,
    answer_key: bytes,
    previous_updated_at: Any,
    log_path: Path,
) -> Any:
    data = get_memo(config["site_base_url"], question_code)
    current_updated_at = data.get("updatedAt")

    if current_updated_at == previous_updated_at:
        return previous_updated_at

    # 同じ不正データや復号不能データを毎回処理しないよう、
    # 更新時刻は処理の成否にかかわらず先に進める。
    next_updated_at = current_updated_at
    payload = data.get("text")

    if not isinstance(payload, str):
        write_log(
            log_path,
            "質問チャンネルのtextが文字列ではないため無視しました。",
        )
        return next_updated_at

    if payload == "":
        return next_updated_at

    if not payload.startswith(MAGIC):
        write_log(
            log_path,
            "質問チャンネルに未暗号化データがあるため無視しました。",
        )
        return next_updated_at

    try:
        question = decrypt_text(payload, question_key)
    except Exception as error:
        write_log(log_path, f"質問の復号に失敗しました: {error}")
        return next_updated_at

    if not question:
        write_log(log_path, "復号した質問が空だったため無視しました。")
        return next_updated_at

    write_log(log_path, "質問を受信しました。")

    try:
        answer = run_claude(
            config["claude_command"],
            config["claude_args"],
            question,
        )
    except Exception as error:
        write_log(log_path, str(error))
        return next_updated_at

    write_log(log_path, "Claudeの呼び出しに成功しました。")

    try:
        answer_payload = encrypt_text(answer, answer_key)
        put_memo(
            config["site_base_url"],
            answer_code,
            answer_payload,
        )
    except Exception as error:
        write_log(log_path, f"回答の送信に失敗しました: {error}")
        return next_updated_at

    write_log(log_path, "回答を送信しました。")
    return next_updated_at


def wait_for_initial_state(
    config: dict[str, Any],
    question_code: str,
    log_path: Path,
) -> Any:
    while True:
        try:
            data = get_memo(config["site_base_url"], question_code)
            return data.get("updatedAt")
        except KeyboardInterrupt:
            raise
        except Exception as error:
            write_log(
                log_path,
                f"質問チャンネルの初期状態を取得できませんでした: {error}",
            )
            time.sleep(config["poll_interval_seconds"])


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "暗号テキスト同期を使って質問を受け取り、"
            "Claude Codeの回答を別チャンネルへ送ります。"
        )
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="1回だけポーリング判定して終了します。",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    base_directory = script_directory()
    config_path = base_directory / CONFIG_FILENAME

    try:
        config = load_config(config_path)
    except RelayError as error:
        print(f"エラー: {error}", file=sys.stderr)
        return 1

    log_path = Path(config["log_file"])
    if not log_path.is_absolute():
        log_path = base_directory / log_path

    try:
        question_code = derive_locker_code(
            config["question_passphrase"]
        )
        question_key = derive_aes_key(
            config["question_passphrase"]
        )
        answer_code = derive_locker_code(
            config["answer_passphrase"]
        )
        answer_key = derive_aes_key(
            config["answer_passphrase"]
        )
    except Exception as error:
        write_log(log_path, f"暗号の準備に失敗しました: {error}")
        return 1

    if question_code == answer_code:
        write_log(
            log_path,
            "質問用と回答用の置き場番号が同じです。"
            "別々の合言葉を設定してください。",
        )
        return 1

    write_log(log_path, "リモコン中継を起動しました。")

    # claude.exeの場所を確定し、ログイン済みかを先に確かめる。
    # 未ログインだと質問が来てから毎回失敗するので、起動時に気づけるようにする。
    config["claude_command"] = resolve_claude_command(
        config["claude_command"],
        log_path,
    )
    check_claude_login(config["claude_command"], log_path)

    try:
        last_updated_at = wait_for_initial_state(
            config,
            question_code,
            log_path,
        )
        write_log(
            log_path,
            "質問チャンネルの初期状態を記録しました。",
        )

        while True:
            time.sleep(config["poll_interval_seconds"])

            try:
                last_updated_at = process_poll(
                    config=config,
                    question_code=question_code,
                    question_key=question_key,
                    answer_code=answer_code,
                    answer_key=answer_key,
                    previous_updated_at=last_updated_at,
                    log_path=log_path,
                )
            except Exception as error:
                write_log(
                    log_path,
                    f"ポーリング処理中にエラーが発生しました: {error}",
                )

            if arguments.once:
                write_log(
                    log_path,
                    "--onceによる1回の判定が終わりました。",
                )
                break

    except KeyboardInterrupt:
        write_log(log_path, "中断操作を受けたため終了します。")
    except Exception as error:
        write_log(log_path, f"予期しないエラーが発生しました: {error}")
        return 1

    write_log(log_path, "リモコン中継を終了しました。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
