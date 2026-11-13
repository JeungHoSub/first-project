#!/bin/bash
# 세션 시작 시 GitHub 최신 내용 받기 (사무실1·사무실2·핸드폰/클라우드 공통)
# 실패해도 세션은 막지 않는다.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git branch --show-current)
timeout 30 git fetch --quiet origin 2>/dev/null || { echo "[동기화] GitHub에 연결하지 못해 최신 내용을 받지 못했습니다."; exit 0; }

msg="[동기화] 브랜치: ${branch:-분리된 HEAD}"
if [ -n "$branch" ] && git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
  if [ -z "$(git status --porcelain)" ]; then
    if git merge --ff-only --quiet "origin/$branch" 2>/dev/null; then
      msg="$msg — 최신 내용으로 업데이트함"
    else
      msg="$msg — ⚠️ 원격과 갈라져 자동으로 받지 못함. 직접 합쳐야 함"
    fi
  else
    msg="$msg — ⚠️ 커밋 안 된 변경이 있어 자동으로 받지 않음"
  fi
fi
if [ -n "$branch" ] && [ "$branch" != "main" ] && git rev-parse --verify --quiet origin/main >/dev/null; then
  behind=$(git rev-list --count "HEAD..origin/main" 2>/dev/null || echo 0)
  [ "$behind" -gt 0 ] && msg="$msg / main에 이 브랜치에 없는 새 커밋 ${behind}개(공용 규칙 변경일 수 있음. 'git log HEAD..origin/main'으로 확인)"
fi
echo "$msg"
exit 0
