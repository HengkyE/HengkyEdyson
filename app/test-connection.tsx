import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { testSupabaseConnection, testBarangById } from '@/utils/supabase-test';
import { getBarangs, getBarangByBarcode } from '@/edysonpos/services/database';

export default function TestConnectionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string, isError: boolean = false) => {
    setResults((prev) => [...prev, `${isError ? '❌' : '✅'} ${message}`]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testConnection = async () => {
    setLoading(true);
    clearResults();
    addResult('Starting connection test...');

    try {
      const success = await testSupabaseConnection();
      if (success) {
        addResult('Connection test passed!');
      } else {
        addResult('Connection test failed. Check console for details.', true);
      }
    } catch (error: any) {
      addResult(`Error: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const testGetBarangs = async () => {
    setLoading(true);
    addResult('Testing getBarangs()...');

    try {
      const data = await getBarangs();
      addResult(`Successfully loaded ${data.length} products`);
      if (data.length > 0) {
        addResult(`First product: ${data[0].barangNama}`);
      }
    } catch (error: any) {
      addResult(`Error: ${error.message}`, true);
      if (error.code === 'PGRST301' || error.status === 406) {
        addResult('This is likely an RLS (Row Level Security) issue.', true);
        addResult('Please check SUPABASE_SETUP.md for instructions.', true);
      }
    } finally {
      setLoading(false);
    }
  };

  const testGetBarangByBarcode = async () => {
    setLoading(true);
    addResult('Testing getBarangByBarcode("ykr0037")...');

    try {
      const data = await getBarangByBarcode('ykr0037');
      if (data) {
        addResult(`Found product: ${data.barangNama}`);
      } else {
        addResult('Product not found (this is OK if it doesn\'t exist)');
      }
    } catch (error: any) {
      addResult(`Error: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const testDirectQuery = async () => {
    setLoading(true);
    addResult('Testing direct Supabase query...');

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error, status } = await supabase
        .from('barangs')
        .select('id, barangNama')
        .limit(5);

      if (error) {
        addResult(`Error: ${error.message} (Status: ${status})`, true);
        addResult(`Code: ${error.code}`, true);
        if (error.details) addResult(`Details: ${error.details}`, true);
        if (error.hint) addResult(`Hint: ${error.hint}`, true);
      } else {
        addResult(`Success! Found ${data?.length || 0} products`);
      }
    } catch (error: any) {
      addResult(`Error: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Test Connection
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Supabase Connection Tests
          </ThemedText>
          <ThemedText style={[styles.description, { color: colors.icon }]}>
            Use these tests to diagnose connection issues. Check the console for detailed logs.
          </ThemedText>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            title="1. Test Basic Connection"
            onPress={testConnection}
            loading={loading}
            style={styles.button}
          />
          <Button
            title="2. Test getBarangs()"
            onPress={testGetBarangs}
            loading={loading}
            style={styles.button}
          />
          <Button
            title="3. Test getBarangByBarcode()"
            onPress={testGetBarangByBarcode}
            loading={loading}
            style={styles.button}
          />
          <Button
            title="4. Test Direct Query"
            onPress={testDirectQuery}
            loading={loading}
            style={styles.button}
          />
          <Button
            title="Clear Results"
            onPress={clearResults}
            variant="outline"
            style={styles.button}
            disabled={results.length === 0}
          />
        </View>

        {results.length > 0 && (
          <Card style={styles.resultsCard}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Test Results
            </ThemedText>
            {results.map((result, index) => (
              <ThemedText
                key={index}
                style={[
                  styles.resultText,
                  {
                    color: result.startsWith('❌') ? colors.error : colors.text,
                  },
                ]}>
                {result}
              </ThemedText>
            ))}
          </Card>
        )}

        <Card style={styles.infoCard}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Troubleshooting
          </ThemedText>
          <ThemedText style={[styles.infoText, { color: colors.icon }]}>
            If you&apos;re getting 406 errors, it&apos;s likely a Row Level Security (RLS) issue.
          </ThemedText>
          <ThemedText style={[styles.infoText, { color: colors.icon }]}>
            See SUPABASE_SETUP.md for instructions on configuring RLS policies.
          </ThemedText>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    width: '100%',
  },
  resultsCard: {
    marginBottom: 16,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  infoCard: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
});

