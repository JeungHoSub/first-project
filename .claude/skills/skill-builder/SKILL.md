---
name: skill-builder
description: 새 스킬이나 새 프로젝트 에이전트를 만들 때 쓰는 형식과 절차.
---

# 스킬 / 에이전트 만드는 법

## 스킬: `.claude/skills/<이름>/SKILL.md`
```
---
name: <영문-소문자-하이픈>
description: <언제 쓰는지 한두 문장. 이 문장으로 자동 선택되므로 구체적으로>
---
# 제목
## 절차 / 규칙 / 체크리스트
```
- 한 스킬은 한 가지 일만. 길면 쪼갠다.
- 참고 자료가 크면 같은 폴더에 별도 파일로 두고 SKILL.md에서 언급.

## 에이전트: `.claude/agents/<이름>.md`
```
---
name: <이름>
description: <어떤 프로젝트/역할에 쓰는지>
tools: Read, Glob, Grep, Write, Edit   # 필요한 것만
model: sonnet                          # 단순 작업은 haiku, 어려운 기획은 opus
---
역할 설명, 작업 전(읽을 파일) / 작업 / 작업 후(handoff) 절차
```

## 새 프로젝트 추가
1. `projects/_template`을 `projects/<이름>`으로 복사, `brief.md` 작성
2. 담당 에이전트 생성 (위 형식)
3. 필요한 스킬 확인 → 없으면 skill-scout
