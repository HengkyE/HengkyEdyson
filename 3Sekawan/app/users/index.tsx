import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorMessage } from "@/components/ui/error-message";
import { SkeletonList } from "@/components/ui/skeleton";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePermissions } from "@/hooks/usePermissions";
import { getAllUserProfiles, updateUserProfile } from "@/services/database";
import type { UserProfile } from "@/types/database";
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
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function UsersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { profile, refreshProfile } = useAuth();
  const { canManageUsers } = usePermissions();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingRole, setEditingRole] = useState<"admin" | "cashier" | "manager">("cashier");
  const [editingIsActive, setEditingIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const data = await getAllUserProfiles();
      setUsers(data);
    } catch (err: any) {
      console.error("Error loading users:", err);
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

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setEditingName(user.fullName);
    setEditingPhone(user.phone || "");
    setEditingRole(user.role);
    setEditingIsActive(user.isActive);
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    if (!editingName.trim()) {
      Alert.alert("Validation Error", "Name is required");
      return;
    }

    try {
      setSaving(true);
      await updateUserProfile(selectedUser.id, {
        fullName: editingName.trim(),
        phone: editingPhone.trim() || null,
        role: editingRole,
        isActive: editingIsActive,
      });
      await loadUsers();
      if (selectedUser.id === profile?.id) {
        await refreshProfile();
      }
      setShowEditModal(false);
      Alert.alert("Success", "User updated successfully");
    } catch (err: any) {
      console.error("Error updating user:", err);
      Alert.alert("Error", err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return colors.error;
      case "manager":
        return colors.warning;
      case "cashier":
        return colors.primary;
      default:
        return colors.icon;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          User Management
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
          <ErrorMessage title="Failed to Load Users" message={error} onRetry={loadUsers} retryLabel="Retry" />
        ) : users.length === 0 ? (
          <EmptyState title="No Users Found" message="No users have been created yet." icon="people-outline" />
        ) : (
          users.map((user) => (
            <Card key={user.id} style={styles.userCard}>
              <TouchableOpacity
                onPress={() => handleEditUser(user)}
                activeOpacity={0.7}
                style={styles.userCardContent}
              >
                <View style={[styles.avatar, { backgroundColor: getRoleColor(user.role) + "20" }]}>
                  <Ionicons name="person" size={24} color={getRoleColor(user.role)} />
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userHeader}>
                    <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                      {user.fullName}
                    </ThemedText>
                    <View
                      style={[
                        styles.roleBadge,
                        { backgroundColor: getRoleColor(user.role) + "20" },
                      ]}
                    >
                      <ThemedText
                        style={[styles.roleBadgeText, { color: getRoleColor(user.role) }]}
                      >
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.userEmail, { color: colors.icon }]}>
                    {user.email}
                  </ThemedText>
                  {user.phone && (
                    <ThemedText style={[styles.userPhone, { color: colors.icon }]}>
                      {user.phone}
                    </ThemedText>
                  )}
                  <View style={styles.userMeta}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: user.isActive
                            ? colors.success + "20"
                            : colors.error + "20",
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusText,
                          {
                            color: user.isActive ? colors.success : colors.error,
                          },
                        ]}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                Edit User
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Full Name</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  value={editingName}
                  onChangeText={setEditingName}
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
                  value={editingPhone}
                  onChangeText={setEditingPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.icon}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Role</ThemedText>
                <View style={styles.roleSelector}>
                  {(["admin", "manager", "cashier"] as const).map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        {
                          backgroundColor:
                            editingRole === role ? colors.primary : colors.background,
                          borderColor: editingRole === role ? colors.primary : colors.icon + "40",
                        },
                      ]}
                      onPress={() => setEditingRole(role)}
                    >
                      <ThemedText
                        style={[
                          styles.roleOptionText,
                          {
                            color: editingRole === role ? "#FFFFFF" : colors.text,
                          },
                        ]}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>Active Status</ThemedText>
                  <Switch
                    value={editingIsActive}
                    onValueChange={setEditingIsActive}
                    trackColor={{ false: colors.icon + "40", true: colors.primary + "40" }}
                    thumbColor={editingIsActive ? colors.primary : colors.icon}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.icon + "30" }]}>
              <Button
                title="Cancel"
                onPress={() => setShowEditModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Save"
                onPress={handleSaveUser}
                loading={saving}
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
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
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
  },
  roleOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

