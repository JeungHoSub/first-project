"""가짜 API 서버/세션. 실제 네트워크와 서비스키를 쓰지 않는다. 아래 키 값은 테스트용 가짜다."""
import json
import math
from datetime import datetime
from urllib.parse import parse_qs, urlparse

from app.config import Settings
from app.db import KST

FAKE_KEY_ENC = "FAKEkeyENC%2Babc%2Fdef%3D%3D1234567890"
FAKE_KEY_DEC = "FAKEkeyENC+abc/def==1234567890"
FAKE_TOKEN = "123456789:AAFAKEtokenFAKEtokenFAKEtoken_xyz12"
FIXED_NOW = datetime(2026, 11, 16, 12, 0, tzinfo=KST)


def make_settings(**kw):
    s = Settings(key_encoding=FAKE_KEY_ENC, key_decoding=FAKE_KEY_DEC, telegram_token=FAKE_TOKEN,
                 db_path=":memory:", num_rows=100, backoff_base_sec=0.0)
    for k, v in kw.items():
        setattr(s, k, v)
    return s


def mk_item(no, ord_="000", reg="2026-11-16 11:50:00", chg=None, **extra):
    item = {
        "bidNtceNo": no, "bidNtceOrd": ord_, "bidNtceNm": f"테스트 공고 {no}",
        "ntceInsttNm": "테스트기관", "dminsttNm": "테스트수요기관",
        "bidNtceDt": reg, "rgstDt": reg, "chgDt": chg or reg,
        "bidClseDt": "2026-11-30 10:00:00", "presmptPrce": "1000000", "asignBdgtAmt": "1100000",
        "bidNtceDtlUrl": f"https://example.invalid/{no}",
        # 저장하면 안 되는 개인정보 필드
        "ntceInsttOfclNm": "홍길동", "ntceInsttOfclTelNo": "02-123-4567",
        "ntceInsttOfclEmailAdrs": "hong@example.go.kr", "dminsttOfclEmailAdrs": "dm@example.go.kr",
        "exctvNm": "김집행",
        # 허용 목록에 없는 새 필드
        "someNewField": "x",
    }
    item.update(extra)
    return item


def json_ok(items, total, page=1, rows=100):
    return json.dumps({"response": {"header": {"resultCode": "00", "resultMsg": "정상"},
                                    "body": {"items": items, "numOfRows": rows, "pageNo": page,
                                             "totalCount": total}}}, ensure_ascii=False)


def json_err(code, msg="ERR"):
    return json.dumps({"nkoneps.com.response.ResponseError": {"header": {"resultCode": code, "resultMsg": msg}}})


class FakeResponse:
    def __init__(self, text, status=200):
        self.text, self.status_code = text, status


class FakeServer:
    """오퍼레이션별 공고 목록을 들고, inqryDiv(1=rgstDt, 3=chgDt)와 기간으로 걸러 쪽수대로 돌려준다."""

    def __init__(self):
        self.data = {}          # 오퍼레이션 이름 -> [item]
        self.calls = []         # (op, params dict, url)
        self.override = None    # callable(op, params) -> FakeResponse 또는 None
        self.exc = None         # 던질 예외(요청마다)

    def add(self, op_suffix, items):
        self.data.setdefault(op_suffix, []).extend(items)

    def get(self, url, timeout=None):
        u = urlparse(url)
        op = u.path.rsplit("/", 1)[-1]
        params = {k: v[0] for k, v in parse_qs(u.query, keep_blank_values=True).items()}
        self.calls.append((op, params, url))
        if self.exc:
            raise self.exc(f"connection failed for url: {url}")
        if self.override:
            r = self.override(op, params)
            if r is not None:
                return r
        items = self.data.get(op, [])
        field = "rgstDt" if params["inqryDiv"] == "1" else "chgDt"
        lo, hi = params["inqryBgnDt"], params["inqryEndDt"]
        hit = [i for i in items if lo <= "".join(c for c in i[field] if c.isdigit())[:12] <= hi]
        rows, page = int(params["numOfRows"]), int(params["pageNo"])
        chunk = hit[(page - 1) * rows: page * rows]
        return FakeResponse(json_ok(chunk, len(hit), page, rows))

    def calls_for(self, op):
        return [c for c in self.calls if c[0] == op]
