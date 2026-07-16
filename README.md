# 기프티냉장콘

기프티콘(모바일 상품권)을 냉장고처럼 보관하고 유효기한을 관리하는 Expo/React Native 앱입니다.

## 주요 기능

- **로그인/인증** — Firebase Auth 기반 사용자 인증
- **기프티콘 등록** — 카메라 촬영 또는 사진첩 이미지로 기프티콘 등록, 브랜드/카테고리/유효기한 입력
- **자동 만료 알림** — 유효기한 3일 전 오전 9시에 로컬 알림 예약 (expo-notifications)
- **목록/상세 관리** — 유효기한 순 정렬, 카테고리(카페/편의점/음식점/문화·여가/기타) 분류, 사용 완료 처리, 삭제
- **실시간 동기화** — Firestore `onSnapshot` 구독으로 기기 간 실시간 반영
- **이미지 저장** — Firebase Storage에 기프티콘 이미지 업로드

## 기술 스택

- [Expo](https://docs.expo.dev/versions/v57.0.0/) 57 / React Native 0.86 / React 19
- TypeScript
- React Navigation (native-stack)
- Firebase (Auth, Firestore, Storage)
- expo-camera, expo-image-picker, expo-notifications

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Firebase 설정

`.env.example`을 복사해 `.env`를 만들고 Firebase 프로젝트 값을 채워주세요.

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

`.env`가 설정되지 않으면 앱은 안내 화면(`SetupRequiredScreen`)을 표시합니다.

### 3. 실행

```bash
npm start        # Expo 개발 서버
npm run android  # Android 에뮬레이터/기기
npm run ios      # iOS 시뮬레이터/기기
npm run web      # 웹
```

## 프로젝트 구조

```
src/
├── components/     # 재사용 UI 컴포넌트 (GifticonCard 등)
├── context/        # AuthContext (인증 상태)
├── firebase/       # Firebase 초기화
├── navigation/      # RootNavigator (화면 라우팅)
├── screens/        # Login, Home, AddGifticon, GifticonDetail, SetupRequired
├── services/       # Firestore/Storage 연동, 알림 스케줄링
├── types/          # 도메인 타입 (Gifticon 등)
└── utils/          # 날짜 관련 유틸
```
