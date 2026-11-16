"""30분마다 한 번 실행되는 진입점. 지금은 수집만 한다. 텔레그램 확인·매칭·발송은 D2에서 붙일 자리만 있다.
실행: python -m app.run_cycle"""
import logging
import logging.handlers
import os
import sys
import time
from datetime import timedelta
from pathlib import Path

from . import db as dbm
from .api import AuthError, G2BClient
from .collector import Collector, parse_dt
from .config import load_settings
from .db import fmt, get_setting, now_kst, set_setting
from .redact import install_log_filter, register_secrets

log = logging.getLogger("g2b.cycle")
LOCK_STALE_SEC = 3600   # 작업 스케줄러에서 1시간 넘으면 중지시키는 설정과 맞춘다


# ---- D2에서 채울 자리 (지금은 아무 일도 하지 않는다) ----
def step_telegram(ctx):
    """1. 텔레그램 새 메시지 확인(/start 연결 코드). D2."""


def step_match(ctx):
    """3. 계정별 조건 vs 새 공고(from_backfill=0만) -> pending_notifications. D2."""


def step_send(ctx):
    """4. 발송 시각이 된 묶음을 텔레그램으로 발송. D2."""


class CycleLock:
    def __init__(self, path):
        self.path = Path(path)

    def acquire(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        for _ in range(2):
            try:
                fd = os.open(str(self.path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, f"{os.getpid()} {time.time()}".encode())
                os.close(fd)
                return True
            except FileExistsError:
                try:
                    if time.time() - self.path.stat().st_mtime > LOCK_STALE_SEC:
                        self.path.unlink()      # 오래된 잠금은 죽은 실행이 남긴 것으로 보고 치운다
                        continue
                except OSError:
                    pass
                return False
        return False

    def release(self):
        try:
            self.path.unlink()
        except OSError:
            pass


def setup_logging(log_dir, settings):
    Path(log_dir).mkdir(parents=True, exist_ok=True)
    register_secrets(settings.all_secrets())
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    fh = logging.handlers.RotatingFileHandler(Path(log_dir) / "run_cycle.log", maxBytes=1_000_000,
                                              backupCount=5, encoding="utf-8")
    sh = logging.StreamHandler()
    fmt_ = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    for h in (fh, sh):
        h.setFormatter(fmt_)
        install_log_filter(h)
        root.addHandler(h)


def run_cycle(settings=None, conn=None, client=None, now_fn=now_kst, use_lock=True):
    """한 바퀴. 결과 dict를 돌려준다(status: ok / locked / error)."""
    settings = settings or load_settings()
    own_conn = conn is None
    conn = conn or dbm.connect(settings.db_path)
    lock = CycleLock(Path(settings.db_path).parent / "run_cycle.lock") if use_lock else None
    if lock and not lock.acquire():
        log.warning("이미 실행 중이라 이번 사이클은 건너뜀")
        return {"status": "locked"}
    result = {"status": "ok", "alerts": [], "incremental": [], "backfill": None, "skipped_collect": False}
    try:
        client = client or G2BClient(settings, conn, now_fn=now_fn)
        collector = Collector(settings, conn, client, now_fn)
        ctx = {"settings": settings, "conn": conn, "client": client, "collector": collector, "result": result}

        step_telegram(ctx)                                    # 1. (D2)

        # 2. 수집. 위험 단계(900)면 60분 간격으로 늦춰 이번 사이클은 건너뛴다
        last_collect = parse_dt(get_setting(conn, "last_collect_at"))
        if client.usage.max_level() in ("danger", "stop") and last_collect and \
                now_fn() - last_collect < timedelta(minutes=55):
            result["skipped_collect"] = True
            log.warning("호출 위험 단계라 이번 사이클 수집을 건너뜀(60분 간격)")
        else:
            try:
                result["incremental"] = collector.run_incremental()
                set_setting(conn, "last_collect_at", fmt(now_fn()))
                if client.usage.max_level() == "ok" or client.usage.max_level() == "warn":
                    result["backfill"] = collector.run_backfill()
            except AuthError as e:
                result["status"] = "error"
                result["error"] = str(e)
                log.error("서비스키 오류: %s", e)

        step_match(ctx)                                       # 3. (D2)
        step_send(ctx)                                        # 4. (D2)

        result["alerts"] = list(client.usage.alerts)
        result["usage_today"] = client.usage.daily_summary()
        return result
    finally:
        if lock:
            lock.release()
        if own_conn:
            conn.close()


def _utf8_console():
    """Windows 명령 프롬프트에서 한글이 깨져 예외가 나지 않게 한다."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass


def main():
    _utf8_console()
    settings = load_settings()
    setup_logging(settings.log_dir, settings)
    res = run_cycle(settings)
    log.info("결과: %s", {k: v for k, v in res.items() if k != "incremental"})
    if res["status"] == "error":
        print("오류로 끝남. logs\\run_cycle.log 를 확인하세요(키 값은 가려져 있음).")
        return 1
    print("완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
