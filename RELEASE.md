# Android 출시 런북

Google Play 첫 배포까지 남은 작업. 코드/설정으로 끝낼 수 있는 건 이미 반영돼 있고,
나머지는 Firebase 콘솔 · Play Console · EAS 계정에서 사람이 해야 하는 것들이다.

## 이미 된 것

- 앱 아이콘/파비콘/알림 아이콘 교체 (`assets/`, `app.json`)
- 스플래시 스크린 설정 — `expo-splash-screen` 플러그인으로 `splash-icon.png` +
  배경색 지정 (SDK 57은 별도 설정 없으면 빈 화면)
- `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` → `android.blockedPermissions` 로 제거
  (바코드 스캔에 오디오 불필요, Play가 사유를 물음)
- **위치 권한 사전 고지(prominent disclosure)** — OS 권한창 이전에 용도/기기 내 사용을
  인앱 다이얼로그로 안내 (`src/shared/utils/location.ts`). 포그라운드용과 백그라운드용
  고지가 각각 별도로 있음 (`ensureForegroundPermission` / `ensureBackgroundLocationPermission`).
- **백그라운드 위치 + 지오펜싱(선택)** — 사용자가 별도 허용하면 앱을 열지 않아도 저장된
  매장 반경 ~160m 진입 시 로컬 알림. `ACCESS_BACKGROUND_LOCATION` +
  `expo-location` geofencing, 최대 18개 리전. 위치는 기기 내에서만 사용·서버 미전송.
  (`src/features/gifticons/services/geofencing.ts`, `geofenceTask.ts`,
  `hooks/useGeofenceSync.ts`; 태스크는 `index.ts` 에서 등록)
- **인앱 계정·데이터 삭제** — `설정 → 계정 삭제`. 클라이언트가 `deleteAccount` Cloud
  Function(`onCall`)을 호출해 계정 + 소유 기프티콘/이미지 + 소유 스페이스 + 스페이스
  참여 기록을 서버에서 삭제하고 로그아웃. 익명/이메일 계정 모두. 로직은
  `functions/accountData.js` 에 분리해 단위 테스트.
- `expo-insights` 추가 — EAS 대시보드에서 기본 사용량/크래시 지표 확인 가능
- Firestore 보안 규칙 자동 테스트가 **실제로 통과** — `npm run test:rules`
  (`firebase-tools` 13.x devDependency, JDK 17). CI에 `rules` job 추가.
- 유닛 테스트, `tsc`(app+test), lint, format 통과

## 남은 작업 (순서대로)

### 1. 개인정보처리방침 게시

- 초안: `docs/privacy-policy.md` (수집 항목·위치·사진·삭제 절차 반영, 완성형)
- `【 】` 표시된 항목(개발자/사업자명, 연락 이메일, 시행일, 보호책임자, 관할)을 채운다.
- 공개 URL이 필요하다 — 자체 도메인 / GitHub Pages / 노션 등에 올린다.
- `src/shared/constants/links.ts` 의 `PRIVACY_POLICY_URL` 을 그 공개 URL로 교체.
- Play Console → 앱 콘텐츠 → 개인정보처리방침에 같은 URL 입력.

### 2. Firebase 프로젝트 설정

```bash
# 규칙·인덱스·스토리지 규칙 배포 (파일만 있고 배포 안 하면 콘솔에 반영 안 됨)
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <PROJECT_ID>

# Cloud Functions 배포 (deleteAccount onCall + 기존 정리 함수). functions/ 첫 배포 시
# 필요: Blaze 요금제, npm --prefix functions install
npx firebase deploy --only functions --project <PROJECT_ID>
```

- Authentication → Sign-in method: **익명** + **이메일/비밀번호** 활성화
  (안 하면 모든 쓰기가 조용히 실패)
- Storage 사용 → **Blaze 요금제**로 업그레이드 (무료 Spark로는 Storage · Functions 불가)
- `deleteAccount` 는 클라이언트 `설정 → 계정 삭제` 가 호출한다. 배포 전에는 인앱 삭제가
  실패하므로, Play **데이터 안전 → 데이터 삭제** 양식을 채우기 전에 배포 + 실제 삭제
  1회 확인.
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
  `expo-brightness`, `expo-insights`, `expo-splash-screen`). 이 빌드가 **첫 프로덕션
  빌드**이므로 컴파일 성공 여부를 여기서 처음 확인하게 된다.
- 산출물은 `.aab` (App Bundle). `eas.json` production 프로필의 `autoIncrement` 가
  versionCode 를 관리한다.

### 4. 실기기 검증

빌드된 `.aab` 또는 internal distribution 빌드를 실제 안드로이드 기기에 설치하고:

- 첫 실행(익명 로그인) → 기프티콘 등록(사진+바코드+유효기한) → 사용완료 → 삭제
- 스페이스 만들기 → 다른 기기/계정으로 코드 참여 → 공유 확인
- 유효기한 알림 수신 (설정한 알림 시각에), 근처 매장 알림
- 앱 종료 상태에서 저장한 매장 좌표 근처 진입 시 지오펜싱 알림 (백그라운드 위치 허용 시)
- 상세 화면 바코드 렌더링 + 밝기 부스트 동작
- 다크 모드 전환 (설정 → 화면 테마) 후 전 화면 확인
- 오프라인 상태 배너, 권한 거부 시 안내
- 위치 권한 첫 요청 시 사전 고지 다이얼로그 → "계속" 눌러야 OS 권한창 (포그라운드,
  이어서 백그라운드 각각)
- `설정 → 계정 삭제` → 확인 → 기프티콘/스페이스/이미지가 서버에서 사라지고 익명
  재로그인 (Cloud Functions 배포 후에만 동작)

### 5. Play Console

- 앱 생성 (패키지명 `com.giftifridge.app`)
- 스토어 등록정보: 폰 스크린샷 2장 이상, 피처 그래픽 1024×500, 아이콘 512×512
- **데이터 안전** 양식 — `docs/privacy-policy.md` 2·3·7항과 일치하게: 위치, 사진, 이메일,
  앱 활동 수집 신고. 위치는 "선택·기능 목적" 으로 (기기 내에서만 사용, 서버 미전송).
  **데이터 삭제** 섹션에 인앱 삭제 경로(`설정 → 계정 삭제`) + 문의 이메일 기재.
- **위치 권한 선언 양식** — 근처 매장 알림 용도, 정밀 위치(FINE) 사용. **백그라운드
  위치(`ACCESS_BACKGROUND_LOCATION`) 사용함** — 앱을 열지 않아도 매장 근처 알림을
  보내는 핵심 기능이며 포그라운드만으로는 불가함을 설명하고, 인앱 사전 고지(포그라운드
  - 백그라운드 2단계) 스크린샷과 기능 시연 영상을 첨부한다. Play는 백그라운드 위치를
    별도 심사하며 승인까지 수 일~수 주 걸릴 수 있음 — 첫 제출 시 여유를 둘 것.
- **사진·동영상 권한 선언 양식** — 사진첩 자동 가져오기(신규 스크린샷 검사)가 시스템
  포토피커로 대체 불가함을 설명 (`READ_MEDIA_IMAGES` 광범위 접근)
- 콘텐츠 등급 설문, 타겟 고객층(아동 대상 아님), 광고 포함 여부(없음)
- 앱 액세스: 익명 로그인이라 리뷰어용 별도 계정 불필요 — 그렇게 기재
- 내부 테스트 트랙 → 검토 → 프로덕션 승격

```bash
npx eas submit -p android --profile production   # 서비스 계정 키 필요
```

## 아직 비어 있는 것 (차단은 아님)

- `storage.rules` 자동 테스트
- `functions/accountData.js` 는 단위 테스트로만 검증됨 — Firestore 에뮬레이터에서
  실제 스페이스/멤버 트리를 만들어 `deleteAccount` 를 end-to-end로 돌려보는 통합
  테스트는 없음. 배포 후 실기기에서 1회 수동 확인으로 갈음.
- 크래시 스택트레이스 수준의 리포팅 — `expo-insights` 는 집계 지표 위주. 필요 시 Sentry.
- FINE 위치를 COARSE로 낮추는 건 하지 않음 — 반경 근처 알림은 대략적 위치
  (수 km 오차)로는 사실상 동작하지 않는다. Play는 기능상 필요하면 FINE을 허용하므로
  위 위치 권한 선언 양식만 제대로 채우면 된다.
- **지오펜싱은 실기기에서만 검증 가능** — 유닛 테스트는 순수 로직(리전 산출/라벨
  저장/알림 발화/권한 게이트)만 덮는다. 배포 전 실기기에서: 매장 위치 저장 → 백그라운드
  위치 "항상 허용" → 앱 완전 종료 → 해당 좌표 근처로 이동(또는 에뮬레이터 mock
  location) → 진입 알림 수신, 알림 탭 시 상세 화면 이동까지 1회 확인.
- iOS는 `startGeofencingAsync` 가 "사용 중에만 허용" 으로도 리전 모니터링/재실행이
  동작하지만, Android(API 29+)는 `ACCESS_BACKGROUND_LOCATION` 없이는 throw 한다.
  `syncGeofences` 는 실패를 삼키므로 권한 거부 시 조용히 비활성.
