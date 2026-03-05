/**
 * Error message component for user-friendly error display
 */

import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '../themed-text';
import { Card } from './card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ErrorMessage({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Try Again',
  icon = 'alert-circle-outline',
}: ErrorMessageProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Card style={styles.container}>
      <View style={styles.content}>
        <Ionicons name={icon} size={48} color={colors.error} style={styles.icon} />
        <ThemedText type="subtitle" style={[styles.title, { color: colors.error }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.message, { color: colors.text }]}>
          {message}
        </ThemedText>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onRetry}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <ThemedText style={styles.retryText}>{retryLabel}</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'No Data',
  message,
  icon = 'document-outline',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Card style={styles.container}>
      <View style={styles.content}>
        <Ionicons name={icon} size={64} color={colors.icon} style={styles.icon} />
        <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.message, { color: colors.icon }]}>
          {message}
        </ThemedText>
        {onAction && actionLabel && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onAction}>
            <ThemedText style={styles.retryText}>{actionLabel}</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

