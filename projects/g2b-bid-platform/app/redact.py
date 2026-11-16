"""서비스키·토큰·연락처 가리기. 로그와 예외 메시지는 반드시 mask_secrets를 거친다."""
import logging
import re
from urllib.parse import quote, unquote

_secrets = set()

# 텔레그램 봇 토큰 모양(123456789:AA....)과 URL 안의 serviceKey= 값
_TOKEN_RE = re.compile(r"\b\d{6,}:[A-Za-z0-9_-]{25,}\b")
_KEY_PARAM_RE = re.compile(r"(?i)(servicekey=)[^&\s'\"]+")
_BOT_URL_RE = re.compile(r"(?i)(api\.telegram\.org/bot)[^/\s'\"]+")


def register_secrets(values):
    """가릴 값을 등록한다. 인코딩 변형(quote/unquote)도 함께 등록."""
    for v in values:
        if not v or len(v) < 6:
            continue
        for variant in {v, quote(v, safe=""), unquote(v), quote(v, safe="/")}:
            if variant and len(variant) >= 6:
                _secrets.add(variant)


def clear_secrets():
    _secrets.clear()


def mask_secrets(text):
    text = str(text)
    for s in sorted(_secrets, key=len, reverse=True):
        text = text.replace(s, "***")
    text = _KEY_PARAM_RE.sub(r"\1***", text)
    text = _BOT_URL_RE.sub(r"\1***", text)
    text = _TOKEN_RE.sub("***", text)
    return text


class SecretFilter(logging.Filter):
    def filter(self, record):
        try:
            record.msg = mask_secrets(record.getMessage())
            record.args = ()
        except Exception:
            pass
        return True


def install_log_filter(handler_or_logger):
    handler_or_logger.addFilter(SecretFilter())


# ---- 연락처 모양 가리기 (자유 문장용) ----
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+")
_PHONE_RES = [
    # 02-123-4567, 031) 123-4567, (02) 1234-5678, +82-10-1234-5678
    re.compile(r"(?<![\d\-])(?:\+82[\-. ]?)?\(?0\d{1,2}\)?[\-. )]\s?\d{3,4}[\-. ]\d{4}(?!\d)"),
    # 구분 없는 휴대전화 01012345678
    re.compile(r"(?<!\d)01[016789]\d{7,8}(?!\d)"),
    # 대표번호 1588-1234
    re.compile(r"(?<![\d\-])1[5-9]\d{2}[\-. ]\d{4}(?!\d)"),
]


def mask_email(text):
    return _EMAIL_RE.sub("[이메일]", text)


def mask_phone(text):
    for rx in _PHONE_RES:
        text = rx.sub("[전화]", text)
    return text


def mask_contacts(text):
    """자유 문장 속 이메일·전화 모양을 가린다."""
    return mask_phone(mask_email(text))
