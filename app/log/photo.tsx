import {useEffect, useRef, useState} from "react";
import {ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, useColorScheme, View,} from "react-native";
import {Camera, CameraView, useCameraPermissions} from "expo-camera";
import {useRouter} from "expo-router";
import {useTranslation} from "react-i18next";
import {theme} from '@/constants/theme';
import {CameraControls} from '@/components/CameraControls';

export default function PhotoCapture() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() as 'light' | 'dark';
  const currentTheme = theme[colorScheme];
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionCheckNeeded, setPermissionCheckNeeded] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;

    if (permissionCheckNeeded) {
      checkInterval = setInterval(async () => {
        try {
          const { status } = await Camera.getCameraPermissionsAsync();
          if (status === "granted" || status === "denied") {
            setPermissionCheckNeeded(false);
            requestPermission();
          }
        } catch (error) {
          console.error("Error checking permission status:", error);
        }
      }, 1000);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [permissionCheckNeeded, requestPermission]);

  const requestPermissionHandler = async () => {
    try {
      setIsRequestingPermission(true);
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermissionCheckNeeded(true);
      if (status !== "granted") {
        Alert.alert(
          t("camera.permission_required"),
          t("camera.permission_message"),
          [{ text: t("common.ok") }]
        );
      }
      router.replace("/log/photo");
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      Alert.alert(t("common.error"), t("camera.permission_error"));
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && cameraReady) {
      try {
        const photoData = await cameraRef.current.takePictureAsync();
        if (photoData && photoData.uri) {
          setPhoto(photoData.uri);
        }
      } catch (error) {
        console.error("Error taking picture:", error);
        Alert.alert(t("common.error"), t("camera.take_photo_error"));
      }
    } else {
      Alert.alert(t("camera.not_ready"), t("camera.wait_ready"));
    }
  };

  const confirmPhoto = () => {
    if (photo) {
      router.push({
        pathname: "/log/manual",
        params: { imageUri: photo },
      });
    }
  };

  const flipCamera = () => {
    setFacing(prev => prev === 'back' ? 'front' : 'back');
  };

  if (isRequestingPermission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={[styles.permissionText, { color: currentTheme.colors.text.primary }]}>
          {t("camera.requesting_access")}
        </Text>
      </View>
    );
  }

  if (permission === null || permissionCheckNeeded) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[styles.permissionText, { color: currentTheme.colors.text.primary }]}>
          {t("camera.checking_access")}
        </Text>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[styles.permissionText, { color: currentTheme.colors.text.primary }]}>
          {t("camera.need_permission")}
        </Text>
        <TouchableOpacity
          onPress={requestPermissionHandler}
          disabled={isRequestingPermission}
          style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: currentTheme.colors.secondary }]}>
            {t("camera.allow_access")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {!photo ? (
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.controlBar}>
            <CameraControls
              onCapture={takePicture}
              onFlip={flipCamera}
              isFlipDisabled={!cameraReady}
            />
          </View>
        </CameraView>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.preview} />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => setPhoto(null)}
              style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
            >
              <Text style={[styles.buttonText, { color: currentTheme.colors.secondary }]}>
                {t("camera.retake")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmPhoto}
              style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
            >
              <Text style={[styles.buttonText, { color: currentTheme.colors.secondary }]}>
                {t("common.confirm")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: "flex-end",
  },
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  button: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 120,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  buttonText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  permissionText: {
    marginBottom: theme.spacing.md,
    textAlign: "center",
    fontSize: theme.typography.body.fontSize,
  },
});
