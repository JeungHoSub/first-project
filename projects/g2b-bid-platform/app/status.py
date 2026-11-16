"""상태 확인과 백업. 실행: python -m app.status   /   python -m app.status --backup 파일경로"""
import sqlite3
import sys

from . import db as dbm
from .api import OPERATIONS
from .config import load_settings
from .db import get_setting


def show(conn, settings):
    print("== 오늘 호출 수(오퍼레이션별) ==")
    today = dbm.now_kst().strftime("%Y-%m-%d")
    rows = conn.execute("SELECT operation, call_count FROM api_usage WHERE date=?", (today,)).fetchall()
    used = {r["operation"]: r["call_count"] for r in rows}
    for op in OPERATIONS.values():
        print(f"  {op}: {used.get(op, 0)}회 (주의 {settings.warn_at} / 위험 {settings.danger_at})")
    print("== 저장된 공고 ==")
    r = conn.execute("SELECT COUNT(*) c, SUM(from_backfill) b FROM bids").fetchone()
    print(f"  전체 {r['c']}건 (백필 {r['b'] or 0}건)")
    print("== 마지막 성공 시각 ==")
    for kind, op in OPERATIONS.items():
        for div, name in ((1, "등록"), (3, "변경")):
            print(f"  {kind} {name}: {get_setting(conn, f'last_ok:{op}:{div}', '-')}")
    raw = get_setting(conn, "backfill_state")
    if raw:
        import json
        tasks = json.loads(raw)["tasks"]
        print(f"== 백필 == 남은 조각 {sum(1 for t in tasks if not t['done'])} / {len(tasks)}")
    print("== 최근 수집 기록 5건 ==")
    for r in conn.execute("SELECT * FROM collect_runs ORDER BY id DESC LIMIT 5"):
        print(f"  {r['finished_at']} {r['run_type']} {r['operation']} div={r['inqry_div']} "
              f"{r['status']} 받음 {r['received_rows']}/{r['total_count']} 호출 {r['calls']}")


def backup(conn, dest):
    """SQLite 백업 기능으로 복사한다(파일을 그냥 복사하지 않는다)."""
    out = sqlite3.connect(dest)
    with out:
        conn.backup(out)
    out.close()
    print(f"백업 완료: {dest}")


def _utf8_console():
    """Windows 명령 프롬프트에서 한글이 깨져 예외가 나지 않게 한다."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass


def main(argv):
    _utf8_console()
    settings = load_settings()
    conn = dbm.connect(settings.db_path)
    if len(argv) >= 2 and argv[0] == "--backup":
        backup(conn, argv[1])
    else:
        show(conn, settings)
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
