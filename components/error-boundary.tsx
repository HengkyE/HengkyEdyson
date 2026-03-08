"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("RootErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll} style={styles.scrollView}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{this.state.error.message}</Text>
            {__DEV__ && this.state.error.stack && (
              <Text style={styles.stack} selectable>
                {this.state.error.stack}
              </Text>
            )}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
  },
  scrollView: { flex: 1 },
  scroll: { paddingBottom: 48 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f87171",
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: "#e2e8f0",
    marginBottom: 16,
  },
  stack: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "monospace",
  },
});
