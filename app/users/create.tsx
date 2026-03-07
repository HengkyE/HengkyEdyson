import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorMessage } from "@/components/ui/error-message";
import { SkeletonList } from "@/components/ui/skeleton";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import { createUserProfile, getUsersWithoutProfiles } from "@/edysonpos/services/database";
import type { UserRole } from "@/edysonpos/types/database";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface UserWithoutProfile {
  id: string;
  email: string;
  created_at: string;
}

export default function CreateUserProfilesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { canManageUsers } = usePermissions();

  const [users, setUsers] = useState<UserWithoutProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithoutProfile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!canManageUsers) {
      Alert.alert("Access Denied", "You do not have permission to manage users.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    loadUsers();
  }, [canManageUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsersWithoutProfiles();
      setUsers(data);
    } catch (err: any) {
      console.error("Error loading users without profiles:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleCreateProfile = (user: UserWithoutProfile) => {
    setSelectedUser(user);
    // Extract name from email as default
    const emailName = user.email.split("@")[0];
    setFullName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    setPhone("");
    setRole("cashier");
    setShowCreateModal(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;

    if (!fullName.trim()) {
      Alert.alert("Validation Error", "Full name is required");
      return;
    }

    try {
      setCreating(true);
      await createUserProfile({
        id: selectedUser.id,
        fullName: fullName.trim(),
        email: selectedUser.email,
        phone: phone.trim() || undefined,
        role,
      });
      await loadUsers();
      setShowCreateModal(false);
      Alert.alert("Success", "User profile created successfully");
    } catch (err: any) {
      console.error("Error creating user profile:", err);
      Alert.alert("Error", err.message || "Failed to create user profile");
    } finally {
      setCreating(false);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case "admin":
        return colors.error;
      case "manager":
        return colors.warning;
      case "cashier":
        return colors.primary;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Create User Profiles
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : error ? (
          <ErrorMessage
            title="Failed to Load Users"
            message={error}
            onRetry={loadUsers}
            retryLabel="Retry"
          />
        ) : users.length === 0 ? (
          <EmptyState
            title="All Users Have Profiles"
            message="All authenticated users have been assigned profiles."
            icon="checkmark-circle-outline"
          />
        ) : (
          <>
            <Card style={styles.infoCard}>
              <View style={styles.infoContent}>
                <Ionicons name="information-circle" size={24} color={colors.primary} />
                <ThemedText style={[styles.infoText, { color: colors.text }]}>
                  {users.length} user{users.length !== 1 ? "s" : ""} without profiles. Create profiles
                  to assign roles and enable access.
                </ThemedText>
              </View>
            </Card>

            {users.map((user) => (
              <Card key={user.id} style={styles.userCard}>
                <View style={styles.userCardContent}>
                  <View style={[styles.avatar, { backgroundColor: colors.icon + "20" }]}>
                    <Ionicons name="person-outline" size={24} color={colors.icon} />
                  </View>
                  <View style={styles.userInfo}>
                    <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                      {user.email}
                    </ThemedText>
                    <ThemedText style={[styles.userDate, { color: colors.icon }]}>
                      Created: {new Date(user.created_at).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <Button
                    title="Create Profile"
                    onPress={() => handleCreateProfile(user)}
                    size="small"
                    style={styles.createButton}
                  />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Create Profile Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Create User Profile
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Email</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={selectedUser?.email || ""}
                  editable={false}
                  placeholderTextColor={colors.icon}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Full Name *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter full name"
                  placeholderTextColor={colors.icon}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Phone</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number (optional)"
                  placeholderTextColor={colors.icon}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Role *</ThemedText>
                <View style={styles.roleSelector}>
                  {(["admin", "manager", "cashier"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roleOption,
                        {
                          backgroundColor: role === r ? getRoleColor(r) : colors.background,
                          borderColor: role === r ? getRoleColor(r) : colors.icon + "40",
                        },
                      ]}
                      onPress={() => setRole(r)}
                    >
                      <Ionicons
                        name={
                          r === "admin"
                            ? "shield-checkmark"
                            : r === "manager"
                            ? "briefcase"
                            : "person"
                        }
                        size={18}
                        color={role === r ? "#FFFFFF" : colors.text}
                        style={styles.roleIcon}
                      />
                      <ThemedText
                        style={[
                          styles.roleOptionText,
                          {
                            color: role === r ? "#FFFFFF" : colors.text,
                          },
                        ]}
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
                <ThemedText style={[styles.roleHint, { color: colors.icon }]}>
                  Admin: Full access | Manager: View/edit transactions & products | Cashier: Sales
                  only
                </ThemedText>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.icon + "30" }]}>
              <Button
                title="Cancel"
                onPress={() => setShowCreateModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Create Profile"
                onPress={handleSaveProfile}
                loading={creating}
                style={styles.modalButton}
                size="large"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
    width: 40,
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
  infoCard: {
    marginBottom: 16,
    padding: 16,
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  userCard: {
    marginBottom: 12,
  },
  userCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  userDate: {
    fontSize: 12,
    marginTop: 4,
  },
  createButton: {
    minWidth: 120,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: "70%",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  roleOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  roleIcon: {
    marginRight: 0,
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  roleHint: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 16,
  },
  modalButton: {
    flex: 1,
  },
});

