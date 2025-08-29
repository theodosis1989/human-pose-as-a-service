// app/index.tsx
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Button, Platform, StyleSheet, Text, View } from "react-native";
import { apiGet } from "../src/lib/api";

const API_BASE = Platform.select({
  ios: "http://localhost:4000", // iOS simulator
  android: "http://10.0.2.2:4000", // Android emulator
  default: "http://localhost:4000", // Web / other
});

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickAndUploadVideo = async () => {
    // On web, ImagePicker doesn't need special permission prompts
    if (Platform.OS !== "web") {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (lib.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Media library permission is required."
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.length) return;

    const fileUri = result.assets[0].uri;

    try {
      setUploading(true);
      setProgress(0);

      // 1) Get the pre-signed URL + required headers from your backend
      const { uploadUrl, key, requiredHeaders } = await apiGet("/upload-url");

      if (Platform.OS === "web") {
        // --- WEB PATH: use fetch + Blob ---
        // Convert the local blob URL (or file URL) to a Blob the browser can send
        const blob = await (await fetch(fileUri)).blob();

        // IMPORTANT: use the exact headers your backend returned (they include If-None-Match and x-amz-meta-*)
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: blob,
          headers: {
            ...requiredHeaders,
            // Make sure Content-Type matches what was signed (usually 'video/mp4')
            "Content-Type": requiredHeaders["Content-Type"] || "video/mp4",
          },
        });

        if (!putRes.ok) {
          const msg = await putRes.text().catch(() => "");
          throw new Error(
            `S3 PUT failed: ${putRes.status} ${putRes.statusText} ${msg}`
          );
        }
      } else {
        // --- NATIVE PATH: use FileSystem.createUploadTask for progress ---
        const uploadTask = FileSystem.createUploadTask(
          uploadUrl,
          fileUri,
          {
            httpMethod: "PUT",
            headers: requiredHeaders,
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          },
          (data) => {
            if (data.totalBytesExpectedToSend > 0) {
              setProgress(data.totalBytesSent / data.totalBytesExpectedToSend);
            }
          }
        );
        const res = await uploadTask.uploadAsync();
        if (!res || res.status !== 200) {
          throw new Error(`S3 PUT failed: ${res?.status} ${res?.body || ""}`);
        }
      }

      Alert.alert("Upload complete", `Key: ${key}`);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload error", e.message ?? String(e));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title={
          uploading
            ? `Uploading… ${Math.round(progress * 100)}%`
            : "Pick & Upload Video"
        }
        onPress={pickAndUploadVideo}
        disabled={uploading}
      />
      {uploading && (
        <Text style={styles.progress}>
          Progress: {Math.round(progress * 100)}%
        </Text>
      )}
      <Text style={styles.note}>
        Web uses fetch+Blob; iOS/Android use FileSystem for progress. Backend
        must return required headers.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: { marginTop: 8 },
  note: { marginTop: 10, opacity: 0.6, textAlign: "center" },
});
