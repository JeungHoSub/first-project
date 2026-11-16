"""설정 읽기. 비밀값은 app/.env 또는 환경 변수에서만 읽고 코드에는 두지 않는다."""
import os
from dataclasses import dataclass, field
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent


def load_env_file(path):
    """아주 단순한 .env 읽기(KEY=VALUE). 따옴표는 벗긴다. 파일이 없으면 빈 dict."""
    result = {}
    p = Path(path)
    if not p.exists():
        return result
    for line in p.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        result[k.strip()] = v
    return result


@dataclass
class Settings:
    key_encoding: str = ""
    key_decoding: str = ""
    telegram_token: str = ""
    scheme: str = "https"
    num_rows: int = 100
    overlap_min: int = 15
    backfill_days: int = 6
    db_path: str = str(APP_DIR / "data" / "g2b.db")
    log_dir: str = str(APP_DIR / "logs")
    warn_at: int = 700
    danger_at: int = 900
    stop_at: int = 990
    max_window_days: int = 6
    backfill_daily_cap: int = 400
    timeout_sec: int = 30
    max_attempts: int = 3
    backoff_base_sec: float = 2.0
    secrets: list = field(default_factory=list)

    def all_secrets(self):
        return [s for s in (self.key_encoding, self.key_decoding, self.telegram_token) if s]


def _int(env, name, default, lo=None, hi=None):
    raw = env.get(name, "").strip()
    try:
        val = int(raw) if raw else default
    except ValueError:
        val = default
    if lo is not None:
        val = max(lo, val)
    if hi is not None:
        val = min(hi, val)
    return val


def load_settings(env_path=None, environ=None):
    file_env = load_env_file(env_path or (APP_DIR / ".env"))
    env = dict(file_env)
    env.update({k: v for k, v in (environ if environ is not None else os.environ).items()
                if k.startswith(("DATA_GO_KR_", "TELEGRAM_", "G2B_"))})
    s = Settings()
    s.key_encoding = env.get("DATA_GO_KR_KEY_ENCODING", "").strip()
    s.key_decoding = env.get("DATA_GO_KR_KEY_DECODING", "").strip()
    s.telegram_token = env.get("TELEGRAM_BOT_TOKEN", "").strip()
    scheme = env.get("G2B_SCHEME", "https").strip().lower()
    s.scheme = scheme if scheme in ("http", "https") else "https"
    s.num_rows = _int(env, "G2B_NUM_ROWS", 100, 1, 999)
    s.overlap_min = _int(env, "G2B_OVERLAP_MIN", 15, 10, 15)  # 결정: 10~15분
    s.backfill_days = _int(env, "G2B_BACKFILL_DAYS", 6, 1, 6)
    if env.get("G2B_DB_PATH"):
        s.db_path = env["G2B_DB_PATH"]
    return s
