# Android 출시 런북

Google Play 첫 배포까지 남은 작업. 코드/설정으로 끝낼 수 있는 건 이미 반영돼 있고,
나머지는 Firebase 콘솔 · Play Console · EAS 계정에서 사람이 해야 하는 것들이다.

## 이미 된 것

- 앱 아이콘/스플래시/파비콘/알림 아이콘 교체 (`assets/`, `app.json`)
- `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` → `android.blockedPermissions` 로 제거
  (바코드 스캔에 오디오 불필요, Play가 사유를 물음)
- `expo-insights` 추가 — EAS 대시보드에서 기본 사용량/크래시 지표 확인 가능
- Firestore 보안 규칙 자동 테스트가 **실제로 통과** — `npm run test:rules`
  (`firebase-tools` 13.x devDependency, JDK 17). CI에 `rules` job 추가.
- 유닛 테스트 419개, `tsc`(app+test), lint, format 통과

## 남은 작업 (순서대로)

### 1. 개인정보처리방침 게시

- 초안: `https://claude.ai/code/artifact/1930f8a3-897e-4b27-a72a-18e6b50eb1f6`
- `【 】` 표시된 항목(개발자/사업자명, 연락 이메일, 시행일, 관할, 계정 삭제 절차)을 채운다.
- 공개 URL이 필요하다 — 위 아티팩트를 공개로 전환하거나, 자체 도메인/노션/깃허브 페이지에 올린다.
- Play Console → 앱 콘텐츠 → 개인정보처리방침에 URL 입력.

### 2. Firebase 프로젝트 설정

```bash
# 규칙·인덱스·스토리지 규칙 배포 (파일만 있고 배포 안 하면 콘솔에 반영 안 됨)
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <PROJECT_ID>
```

- Authentication → Sign-in method: **익명** + **이메일/비밀번호** 활성화
  (안 하면 모든 쓰기가 조용히 실패)
- Storage 사용 → **Blaze 요금제**로 업그레이드 (무료 Spark로는 Storage 불가)
- `storage.rules` 는 아직 자동 테스트가 없다 — 배포 후 실제 업로드/다운로드/삭제를
  본인 계정 / 남의 계정으로 각각 확인.

### 3. EAS 환경변수 + 프로덕션 빌드

`.env` 는 gitignore 라 EAS 빌드에 자동 포함되지 않는다. `EXPO_PUBLIC_FIREBASE_*` 6개를
EAS 환경변수로 등록:

```bash
npx eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..." --environment production
# ... AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID 반복
# (또는 expo.dev 대시보드에서 입력)

npx eas build -p android --profile production
```

- 이번에 네이티브 모듈이 여럿 추가됐다 (`react-native-svg`, `expo-haptics`,
  `expo-brightness`, `expo-insights`). 이 빌드가 **첫 프로덕션 빌드**이므로 컴파일
  성공 여부를 여기서 처음 확인하게 된다.
- 산출물은 `.aab` (App Bundle). `eas.json` production 프로필의 `autoIncrement` 가
  versionCode 를 관리한다.

### 4. 실기기 검증

빌드된 `.aab` 또는 internal distribution 빌드를 실제 안드로이드 기기에 설치하고:

- 첫 실행(익명 로그인) → 기프티콘 등록(사진+바코드+유효기한) → 사용완료 → 삭제
- 스페이스 만들기 → 다른 기기/계정으로 코드 참여 → 공유 확인
- 유효기한 알림 수신, 근처 매장 알림
- 상세 화면 바코드 렌더링 + 밝기 부스트 동작
- 오프라인 상태 배너, 권한 거부 시 안내

### 5. Play Console

- 앱 생성 (패키지명 `com.giftifridge.app`)
- 스토어 등록정보: 폰 스크린샷 2장 이상, 피처 그래픽 1024×500, 아이콘 512×512
- **데이터 안전** 양식 — 개인정보처리방침 2·3·7항과 일치하게: 위치, 사진, 이메일,
  앱 활동 수집 신고. 위치는 "선택·기능 목적" 으로.
- **위치 권한 사전 고지** — 근처 매장 알림 용도 명시 (백그라운드 위치 없음)
- 콘텐츠 등급 설문, 타겟 고객층, 광고 포함 여부(없음)
- 앱 액세스: 익명 로그인이라 리뷰어용 별도 계정 불필요 — 그렇게 기재
- 내부 테스트 트랙 → 검토 → 프로덕션 승격

```bash
npx eas submit -p android --profile production   # 서비스 계정 키 필요
```

## 아직 비어 있는 것 (차단은 아님)

- `storage.rules` 자동 테스트
- 계정/데이터 삭제 인앱 기능 — 현재는 개별 기프티콘/스페이스/계정 단위 삭제만.
  Play는 계정 생성 앱에 삭제 요청 경로를 요구하므로, 최소한 문의처 기반 절차를
  개인정보처리방침에 명시(초안 8항에 표시해 둠).
- 크래시 스택트레이스 수준의 리포팅 — `expo-insights` 는 집계 지표 위주. 필요 시 Sentry.
