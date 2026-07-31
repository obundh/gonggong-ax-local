# 공공AX 로컬 시리즈 5 - 문서 리소스 추출기

문서를 직접 ZIP으로 바꾸거나 내부 폴더를 찾아다닐 필요 없이, 문서에 들어 있는
이미지·영상·오디오·첨부파일·글꼴·서식·스크립트·문서 구조를 자동으로 분류해
꺼내는 Windows용 도구입니다. 분석은 PC의 로컬 브라우저 메모리에서 처리하며
원본 문서는 바꾸지 않습니다.

> **처음 사용하는 분:** 아래 공식 릴리스의 `Assets`에서
> `GonggongAX-Series5-Resource-Extractor-0.1.0-win-x64.zip`을 받은 뒤,
> 압축을 풀고 `시리즈5_실행.cmd`를 더블클릭하세요. GitHub가 자동으로 만드는
> `Source code (zip)`은 실행용 파일이 아닙니다.

[Windows용 시리즈 5 릴리스 열기](https://github.com/obundh/gonggong-ax-local-2/releases/tag/series5-v0.1.0) ·
[실행용 ZIP 바로 받기](https://github.com/obundh/gonggong-ax-local-2/releases/download/series5-v0.1.0/GonggongAX-Series5-Resource-Extractor-0.1.0-win-x64.zip) ·
[만화 5장 ZIP 받기](https://github.com/obundh/gonggong-ax-local-2/releases/download/series5-v0.1.0/GonggongAX-Series5-Beginner-Comic.zip) ·
[초보자용 전체 설명서](docs/SERIES5_BEGINNER_GUIDE.md)

![공공AX 로컬 시리즈 5 문서 리소스 추출기 소개](public/series5/comic/series5-comic-01.png)

## 시리즈 5 빠른 실행

1. [공식 `series5-v0.1.0` 릴리스](https://github.com/obundh/gonggong-ax-local-2/releases/tag/series5-v0.1.0)를 엽니다.
2. 아래쪽 `Assets`에서 정확히
   `GonggongAX-Series5-Resource-Extractor-0.1.0-win-x64.zip`을 누릅니다.
3. 브라우저의 `다운로드` 폴더에서 ZIP을 찾아 `모두 압축 풀기`를 누릅니다.
4. 압축을 푼 폴더의 `시리즈5_실행.cmd`를 더블클릭합니다.
5. 열린 시리즈 5 창에 문서를 고르거나 끌어놓고, 필요한 리소스를 저장합니다.

다운로드 위치 찾기, SHA-256 확인, SmartScreen 판단, 지원 형식 33종, 오류 해결,
삭제 방법은 [초보자용 전체 설명서](docs/SERIES5_BEGINNER_GUIDE.md)에 화면 순서대로
정리했습니다.

## 시리즈 5 지원 형식

- HWPX: `.hwpx`
- Word: `.docx`, `.docm`, `.dotx`, `.dotm`
- PowerPoint: `.pptx`, `.pptm`, `.potx`, `.potm`, `.ppsx`, `.ppsm`
- Excel: `.xlsx`, `.xlsm`, `.xlsb`, `.xltx`, `.xltm`
- OpenDocument: `.odt`, `.ods`, `.odp`, `.odg`, `.ott`, `.ots`, `.otp`, `.otg`
- Visio: `.vsdx`, `.vsdm`, `.vssx`, `.vssm`, `.vstx`, `.vstm`
- XPS: `.xps`, `.oxps`
- 전자책: `.epub`

파일 한 개의 최대 크기는 100 MB입니다. 구형 바이너리 형식인 HWP·DOC·PPT·XLS,
PDF, 일반 ZIP, 암호·DRM이 적용된 파일, 손상된 파일은 지원하지 않습니다. 매크로가
포함된 문서도 매크로를 실행하지 않고 관련 파일을 별도 리소스로 분류합니다.

## 시리즈 5 만화 안내 5장

1. [문서 리소스 추출기 소개](public/series5/comic/series5-comic-01.png)
2. [GitHub Releases에서 실행용 ZIP 받기](public/series5/comic/series5-comic-02.png)
3. [압축 풀고 `시리즈5_실행.cmd` 실행하기](public/series5/comic/series5-comic-03.png)
4. [문서 넣고 자동 분류 결과 확인하기](public/series5/comic/series5-comic-04.png)
5. [개별 파일 또는 전체 ZIP 저장하기](public/series5/comic/series5-comic-05.png)

만화의 대체텍스트·제작 사양·출처는
[만화 자료 안내](public/series5/comic/README.md)에 정리했습니다.

---

# 공공AX 로컬 시리즈 2 - 문서 검수

HWP·HWPX·DOCX·TXT 문서를 외부 서버로 보내지 않고, Windows PC 안에서
맞춤법·띄어쓰기·문서 표기·공공언어 규칙으로 검사하는 로컬 우선 도구입니다.

![공공AX 로컬 시리즈 2 문서 검수 사용 화면](public/document-review-hero.png)

## 실제 구동 화면

아래 이미지는 생성형 UI가 아니라 `http://localhost:3000/series2`에서 직접 캡처한
실제 실행 화면입니다.

![공공AX 로컬 시리즈 2 실제 전체 검사 화면](public/threads/actual-app-overview.png)

`맞춤법`만 누르면 원문 형광펜과 오른쪽 검사 결과가 함께 맞춤법 항목으로
좁혀집니다.

![공공AX 로컬 시리즈 2 실제 맞춤법 필터 화면](public/threads/actual-app-spelling-filter.png)


## 내려받기

[최신 Windows 실행파일](../../releases/latest)을 내려받아
`GonggongAX-Series2-Document-Review-0.1.0-win-x64.exe`를 실행합니다.
설치 과정이나 별도 서버 설정은 없습니다. 처음 실행할 때 Windows
SmartScreen이 게시자를 확인하지 못할 수 있습니다. 현재 실행파일은 코드 서명되지
않았으므로 릴리스의 SHA-256 값과 일치하는지 확인해 주세요.

## 3분 사용법

1. 실행파일을 열고 `문서 불러오기`를 누릅니다.
2. HWP, HWPX, DOCX 또는 UTF-8 TXT 파일을 선택합니다.
3. 원문 미리보기의 형광펜과 말풍선으로 오류 위치와 제안을 확인합니다.
4. `맞춤법`, `띄어쓰기`, `공공언어` 등 필요한 범주만 눌러 미리보기를 거릅니다.
5. 결과를 한 건씩 적용하거나, 확신도가 높은 항목만 `안전 수정`으로 적용합니다.
6. 수정본 TXT 또는 검사보고서 CSV를 내려받습니다. 원본 파일은 바꾸지 않습니다.

화면별 설명과 제한사항은 [사용 설명서](docs/USER_GUIDE.md)에 정리했습니다.
앱 안의 `미묘한 맞춤법 10건 열기`를 누르면 파일 없이 바로 시험할 수 있습니다.

## 주요 기능

- HWP/HWPX의 글꼴·표·그림·쪽 배치를 페이지 SVG로 로컬 재현
- 쪽별 원문 미리보기와 현재 쪽 검사 결과를 나란히 표시
- 오류 위치를 범주별 형광펜으로 표시하고 마우스를 올리면 제안 말풍선 표시
- 맞춤법·띄어쓰기·공공언어 등 범주를 단독 또는 복수 선택
- 최초 원문과 수정 적용 결과를 줄별 전후 비교
- 국립국어원 공공언어 용어 1,331개를 빌드에 포함
- 외부 맞춤법 API, 파일 업로드 API, 원격 저장소를 사용하지 않음

## 지원 범위와 한계

- HWP 5.0, HWPX, DOCX, UTF-8 TXT를 지원합니다.
- 암호가 걸렸거나 배포용인 문서, HWP 5.0보다 오래된 형식은 열리지 않을 수 있습니다.
- DOCX/TXT 미리보기는 읽기 편한 가상 페이지입니다.
- 원본 형식을 보존한 DOCX 재생성과 HWP/HWPX 원본 직접 수정은 아직 지원하지 않습니다.
- 규칙 기반 제안은 법률·정책·행정 문맥의 정답을 보장하지 않습니다. 배포 전 담당자가
  원문과 근거를 최종 확인해야 합니다.

## 개발 및 빌드

요구 환경은 Node.js 22.13 이상과 Windows x64입니다.

```bash
npm ci
npm test
npm run desktop:build
```

포터블 실행파일은
`release/GonggongAX-Series2-Document-Review-0.1.0-win-x64.exe`에 생성됩니다.
실행 시 PC 내부의 임시 주소만 사용하며 시작 화면은 `/series2`입니다.

```bash
npm run dev
```

개발 화면은 `http://localhost:3000/series2`에서 확인합니다.

## 데이터·라이선스·법적 고지

- 공공언어 데이터: 국립국어원, 공공누리 제1유형(출처표시)
- 프로젝트 자체 코드·문서·생성 이미지는 별도 허락이 없는 한 저작권자가 권리를
  보유합니다.
- 오픈소스 구성요소는 각 구성요소의 라이선스를 따릅니다.
- `HWP`, `HWPX` 명칭과 형식은 한글과컴퓨터와 관련될 수 있으며, 이 프로젝트는
  한글과컴퓨터가 제작·보증·후원한 제품이 아닙니다.

자세한 내용은 [법적·라이선스 검토](docs/LEGAL_REVIEW.md),
[제3자 고지](THIRD_PARTY_NOTICES.md), [프로젝트 라이선스](LICENSE)를 확인하세요.

## 시리즈

- `/`: 공공AX 로컬 시리즈 1 업무공간
- `/series2`: 공공AX 로컬 시리즈 2 - 문서 검수
- `/series3`: 공공AX 로컬 시리즈 - 인수인계
- `/series5`: 공공AX 로컬 시리즈 5 - 문서 리소스 추출기
