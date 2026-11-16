# 화투 일러스트 변환

원본: 사용자가 제공한 디자인메카 화투 일러스트 `.ai` (Illustrator 10 형식, CorelDRAW에서 내보냄). 원본 파일은 저장소에 넣지 않는다(라이선스상 원본 재배포 주의).

1. `.ai` 안의 Illustrator 원본 데이터(PDF 객체 8, ASCIIHex+Flate)를 풀어 `native.ai`로 저장
2. `python3 ai2svg.py native.ai all.svg` — 경로·CMYK 색만 SVG로 변환
3. `python3 split_cards.py all.svg cards/ ../../src/ui/hwatu-data.ts` — 빨간 테두리 48개 기준으로 카드별로 자르고 카드 id에 연결 (위 12월→아래 1월, 열 순서 = engine/cards.ts)
