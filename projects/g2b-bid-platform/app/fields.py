"""저장 전 가공. d0-confirmed.md의 허용 필드만 남기고 자유 문장 속 연락처 모양을 가린다."""
import json
import logging

from .redact import mask_contacts, mask_email

log = logging.getLogger("g2b.fields")

COMMON = {
    # 식별
    "bidNtceNo", "bidNtceOrd", "reNtceYn", "rgstTyNm", "ntceKindNm", "untyNtceNo", "refNo", "befBidBbancNo",
    # 이름·기관
    "bidNtceNm", "ntceInsttCd", "ntceInsttNm", "dminsttCd", "dminsttNm",
    # 방식
    "bidMethdNm", "cntrctCnclsMthdNm", "sucsfbidMthdCd", "sucsfbidMthdNm", "intrbidYn", "dsgntCmptYn",
    "indstrytyLmtYn", "prdctClsfcLmtYn",
    # 일정
    "bidNtceDt", "bidBeginDt", "bidClseDt", "opengDt", "bidQlfctRgstDt", "rgstDt", "chgDt",
    # 금액
    "asignBdgtAmt", "presmptPrce", "sucsfbidLwltRate", "indutyVAT",
    # 품목
    "dtilPrdctClsfcNo", "dtilPrdctClsfcNm", "prdctSpecNm", "prdctQty", "prdctUnit",
    # 링크
    "bidNtceDtlUrl", "bidNtceUrl",
    # 정정
    "chgNtceRsn",
}
JNT = {"jntcontrctDutyRgnNm1", "jntcontrctDutyRgnNm2", "jntcontrctDutyRgnNm3"}
SERVC_EXTRA = {"srvceDivNm", "pubPrcrmntClsfcNo", "pubPrcrmntClsfcNm", "pubPrcrmntLrgclsfcNm",
               "pubPrcrmntMidclsfcNm"} | JNT
CNSTWK_EXTRA = {"mainCnsttyNm", "cnstrtsiteRgnNm", "bdgtAmt"} | JNT

ALLOWED_BY_KIND = {
    "물품": COMMON,
    "용역": COMMON | SERVC_EXTRA,
    "공사": COMMON | CNSTWK_EXTRA,
}

# 저장 금지(이중 안전장치): 허용 목록에 없으므로 어차피 안 남지만, 이름을 명시해 둔다.
FORBIDDEN = {
    "ntceInsttOfclNm", "ntceInsttOfclTelNo", "ntceInsttOfclEmailAdrs", "dminsttOfclEmailAdrs", "exctvNm",
    "bidwinnrCeoNm", "bidwinnrTelNo", "bidwinnrAdrs", "bidwinnrBizno",
}

# 전화 모양까지 가리는 자유 문장 필드(이메일 모양은 모든 문자열에서 가림)
FREE_TEXT = {"chgNtceRsn", "bidNtceNm", "prdctSpecNm", "dtilPrdctClsfcNm"}


def sanitize_item(item, kind, unknown_sink=None):
    """응답 한 건 -> 허용 필드만 남기고 연락처 모양을 가린 dict.
    허용 목록에 없는 필드 이름은 unknown_sink(set)에 모은다(값은 남기지 않는다)."""
    allowed = ALLOWED_BY_KIND[kind]
    out = {}
    for k, v in item.items():
        if k in allowed:
            if v is None:
                continue
            if isinstance(v, str):
                v = v.strip()
                if v == "":
                    continue
                v = mask_contacts(v) if k in FREE_TEXT else mask_email(v)
            out[k] = v
        elif k not in FORBIDDEN and unknown_sink is not None:
            unknown_sink.add(k)
    return out


def _join(*vals):
    vals = [str(v) for v in vals if v]
    return ", ".join(vals) if vals else None


def to_row(clean, kind):
    """허용 필드 dict -> bids 개별 칸 dict. 공고번호·차수가 없으면 None."""
    no = clean.get("bidNtceNo")
    if not no:
        return None
    ord_ = clean.get("bidNtceOrd") or "000"
    if kind == "공사":
        region = clean.get("cnstrtsiteRgnNm") or _join(*(clean.get(k) for k in sorted(JNT)))
        industry = clean.get("mainCnsttyNm")
    else:
        region = _join(*(clean.get(k) for k in sorted(JNT)))
        industry = clean.get("pubPrcrmntClsfcNm") or clean.get("srvceDivNm")
    return {
        "bid_no": str(no), "bid_ord": str(ord_), "kind": kind,
        "title": clean.get("bidNtceNm"),
        "ntce_instt_nm": clean.get("ntceInsttNm"),
        "dminstt_nm": clean.get("dminsttNm"),
        "region": region,
        "industry": industry,
        "prdct_clsfc": clean.get("dtilPrdctClsfcNm"),
        "presmpt_prce": clean.get("presmptPrce"),
        "asign_bdgt_amt": clean.get("asignBdgtAmt") or clean.get("bdgtAmt"),
        "bid_ntce_dt": clean.get("bidNtceDt"),
        "bid_clse_dt": clean.get("bidClseDt"),
        "openg_dt": clean.get("opengDt"),
        "rgst_dt": clean.get("rgstDt"),
        "chg_dt": clean.get("chgDt"),
        "url": clean.get("bidNtceDtlUrl") or clean.get("bidNtceUrl"),
        "raw_json": json.dumps(clean, ensure_ascii=False, sort_keys=True),
    }
