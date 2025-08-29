import React, { useState } from "react";
import {
  Alert,
  Button,
  Platform,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadVideoToS3 } from "../src/lib/uploadToS3";

export default function Home() {
  const [uploading, setUploading] = useState(false);

  async function pickAndUploadVideo() {
    console.log("[pickAndUploadVideo] start");
    try {
      // Let the user pick a video from the library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });

      if (result.canceled) {
        console.log("[pickAndUploadVideo] canceled");
        return;
      }

      const fileUri = result.assets?.[0]?.uri;
      console.log("[pickAndUploadVideo] selected fileUri:", fileUri);
      if (!fileUri) {
        Alert.alert("No file selected");
        return;
      }

      setUploading(true);
      console.log("[pickAndUploadVideo] calling uploadVideoToS3");
      const { key } = await uploadVideoToS3(fileUri);
      console.log("[pickAndUploadVideo] upload done", key);
      Alert.alert("Upload complete", `Key: ${key}`);
    } catch (e: any) {
      console.error("[pickAndUploadVideo] error", e);
      Alert.alert("Upload failed", e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          {Platform.OS === "web" ? "Web" : "Native"} Upload (Presigned POST)
        </Text>
        <Button
          title={uploading ? "Uploading..." : "Pick & Upload Video"}
          onPress={pickAndUploadVideo}
          disabled={uploading}
        />
      </View>
    </SafeAreaView>
  );
}
