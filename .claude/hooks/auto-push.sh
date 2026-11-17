#!/bin/bash
# 응답이 끝날 때마다 변경 사항을 자동 커밋·푸시 (Stop 훅)
# - main 브랜치에는 자동 푸시하지 않는다 (공용 규칙은 사람이 확인 후 합친다)
# - .gitignore에 있는 파일(영상·음성·비밀값)과 50MB 넘는 파일은 올리지 않는다
# - 실패해도 작업을 막지 않는다
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
branch=$(git branch --show-current)
[ -z "$branch" ] && exit 0
[ "$branch" = "main" ] && exit 0
[ -z "$(git status --porcelain)" ] && [ -z "$(git log "origin/$branch..HEAD" 2>/dev/null)" ] && exit 0

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  # 50MB 넘는 파일은 빼고 경고
  git diff --cached --name-only -z | while IFS= read -r -d '' f; do
    if [ -f "$f" ] && [ "$(stat -c %s "$f")" -gt 52428800 ]; then
      git reset --quiet -- "$f"
      echo "[자동 저장] 50MB 넘는 파일은 올리지 않음: $f" >&2
    fi
  done
  git diff --cached --quiet || git commit --quiet -m "자동 저장: $(date '+%Y-%m-%d %H:%M') ($(hostname))" || exit 0
fi
for i in 1 2 3; do
  timeout 60 git push --quiet -u origin "$branch" 2>/dev/null && exit 0
  sleep $((i * 2))
done
echo "[자동 저장] 푸시 실패 — 다음 응답 때 다시 시도합니다." >&2
exit 0
