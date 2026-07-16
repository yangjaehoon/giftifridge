import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SetupRequiredScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Firebase 설정이 필요해요</Text>
      <Text style={styles.body}>
        프로젝트 루트의 .env.example 파일을 .env로 복사한 뒤, Firebase 콘솔에서 발급받은 값을
        채워주세요. 값을 입력한 후에는 앱을 다시 시작해야 적용됩니다.
      </Text>
      <View style={styles.steps}>
        <Text style={styles.step}>1. https://console.firebase.google.com 에서 프로젝트 생성</Text>
        <Text style={styles.step}>2. 웹 앱 추가 후 SDK 설정값 복사</Text>
        <Text style={styles.step}>3. Authentication에서 이메일/비밀번호 로그인 활성화</Text>
        <Text style={styles.step}>4. Firestore Database, Storage 생성</Text>
        <Text style={styles.step}>5. .env 파일에 값 입력 후 앱 재시작</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, color: '#444' },
  steps: { gap: 8 },
  step: { fontSize: 13, color: '#333' },
});
