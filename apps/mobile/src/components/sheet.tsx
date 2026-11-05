import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

import { IconButton } from './pressable';
import { Heading } from './text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Cap the sheet height (lists). */
  maxHeight?: `${number}%`;
}

/** Bottom sheet on a dimmed backdrop. Back button and backdrop tap close it. */
export function Sheet({ visible, onClose, title, children, maxHeight = '88%' }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.backdrop} />
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(200)}
          style={[styles.sheet, { maxHeight, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        >
          <View style={styles.handle} />
          {title ? (
            <View style={styles.head}>
              <Heading size={26} style={styles.title}>
                {title}
              </Heading>
              <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} color={colors.ink2} />
            </View>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,5,4,0.62)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line2,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line3, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8 },
  title: { flex: 1 },
});
