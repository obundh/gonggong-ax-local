# 출처 및 제3자 구성요소

## 국립국어원 공공언어 데이터

- 자료명: 문화체육관광부 국립국어원_쉽고 바른 공공언어 쓰기 평가용 용어 목록
- 기준일: 2024-02-28
- 제공처: 공공데이터포털
- 원문: <https://www.data.go.kr/data/15130006/fileData.do>
- 이용조건: 공공누리 제1유형(출처표시)

이 프로젝트의 `data/public-language.json`은 위 CSV의 용어, 이표기·오표기,
대안어를 로컬 검사에 적합한 구조로 변환한 스냅샷입니다.

## JSZip

- 프로젝트: <https://stuk.github.io/jszip/>
- 라이선스: MIT 또는 GPLv3
- 사용 목적: 브라우저 안에서 DOCX와 HWPX ZIP/XML 구조 읽기

이 프로젝트는 JSZip을 MIT 라이선스로 사용합니다.

> Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz
> Buchinger, António Afonso
>
> Permission is hereby granted, free of charge, to any person obtaining a
> copy of this software and associated documentation files (the "Software"),
> to deal in the Software without restriction, including without limitation
> the rights to use, copy, modify, merge, publish, distribute, sublicense,
> and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
> FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
> DEALINGS IN THE SOFTWARE.

## 내장 맞춤법 규칙

`app/series2/rule-engine.ts`의 맞춤법·띄어쓰기·문서 표기 패턴은 국립국어원
어문 규범을 참고해 이 프로젝트에서 작성한 실행 규칙입니다. 자동 수정 결과는
원문의 법적·정책적 의미를 보증하지 않으며, 최종 검토 책임은 문서 담당자에게
있습니다.
