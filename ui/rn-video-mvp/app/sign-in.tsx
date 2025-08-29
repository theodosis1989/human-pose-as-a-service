import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { supabase } from "../src/lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      Alert.alert("Signed in", "Welcome back!");
    } catch (e: any) {
      Alert.alert("Sign in failed", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        placeholder="email@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={busy ? "Signing in…" : "Sign in"}
        onPress={onSignIn}
        disabled={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, marginBottom: 16, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
});
