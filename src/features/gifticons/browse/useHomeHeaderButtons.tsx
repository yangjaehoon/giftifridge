import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigationTypes';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** Installs the home header's "달력" and "설정" links via navigation.setOptions. */
export function useHomeHeaderButtons(navigation: Nav) {
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Calendar')}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="만료 달력"
          >
            <Text style={styles.link}>달력</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="설정"
          >
            <Text style={styles.link}>설정</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, styles]);
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    actions: { flexDirection: 'row', gap: 16, marginRight: 4 },
    link: { color: colors.primary, fontSize: 13 },
  });
