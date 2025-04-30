import React, { useState, useRef, useEffect } from 'react';
import { View, Button, StyleSheet, Image, Text, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PhotoCapture() {
    const { t } = useTranslation();
    const [permission, requestPermission] = useCameraPermissions();
    const [photo, setPhoto] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);
    const [permissionCheckNeeded, setPermissionCheckNeeded] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const router = useRouter();

    // Regelmäßige Überprüfung nach einer Berechtigungsanfrage
    useEffect(() => {
        let checkInterval: NodeJS.Timeout | null = null;

        if (permissionCheckNeeded) {
            // Starte eine regelmäßige Überprüfung des Berechtigungsstatus
            checkInterval = setInterval(async () => {
                console.log("Checking if permission was granted...");
                try {
                    // Manuelles Abrufen des aktuellen Berechtigungsstatus
                    const { status } = await Camera.getCameraPermissionsAsync();
                    console.log("Current permission status:", status);

                    // Wenn sich der Status geändert hat, beenden wir die Überprüfung
                    if (status === 'granted' || status === 'denied') {
                        setPermissionCheckNeeded(false);
                        // Manuell den Hook aktualisieren, indem requestPermission aufgerufen wird
                        requestPermission();
                    }
                } catch (error) {
                    console.error("Error checking permission status:", error);
                }
            }, 1000); // Alle 1 Sekunde überprüfen
        }

        // Aufräumen beim Unmount
        return () => {
            if (checkInterval) clearInterval(checkInterval);
        };
    }, [permissionCheckNeeded, requestPermission]);

    const requestPermissionHandler = async () => {
        try {
            setIsRequestingPermission(true);
            console.log("Requesting camera permission...");

            // Manuelles Anfordern der Berechtigung mit dem nativen Modul
            const { status } = await Camera.requestCameraPermissionsAsync();

            console.log("Camera permission status:", status);

            // Nach der Anfrage starten wir eine regelmäßige Überprüfung
            setPermissionCheckNeeded(true);

            if (status !== 'granted') {
                Alert.alert(
                    t('camera.permission_required'),
                    t('camera.permission_message'),
                    [
                        { text: t('common.ok') }
                    ]
                );
            }

            // Seite neu laden nach Berechtigungsanfrage
            router.replace('/log/photo');

        } catch (error) {
            console.error("Error requesting camera permission:", error);
            Alert.alert(t('common.error'), t('camera.permission_error'));
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
                console.error('Error taking picture:', error);
                Alert.alert(t('common.error'), t('camera.take_photo_error'));
            }
        } else {
            Alert.alert(t('camera.not_ready'), t('camera.wait_ready'));
        }
    };

    const confirmPhoto = () => {
        if (photo) {
            router.push({
                pathname: '/log/manual',
                params: { image: photo },
            });
        }
    };

    // Anzeige während Permission-Abfrage läuft
    if (isRequestingPermission) {
        return (
            <View style={styles.permissionContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.permissionText}>{t('camera.requesting_access')}</Text>
            </View>
        );
    }

    // Anzeige wenn Permission fehlt oder überprüft wird
    if (permission === null || permissionCheckNeeded) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>{t('camera.checking_access')}</Text>
                <ActivityIndicator size="small" color="#0000ff" />
            </View>
        );
    }

    // Anzeige wenn Permission abgelehnt wurde
    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>{t('camera.need_permission')}</Text>
                <Button
                    title={t('camera.allow_access')}
                    onPress={requestPermissionHandler}
                    disabled={isRequestingPermission}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!photo ? (
                <CameraView
                    style={styles.camera}
                    facing="back"
                    ref={cameraRef}
                    onCameraReady={() => setCameraReady(true)}
                >
                    <View style={styles.buttonContainer}>
                        <Button title={t('camera.take_photo')} onPress={takePicture} />
                    </View>
                </CameraView>
            ) : (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: photo }} style={styles.preview} />
                    <Button title={t('common.confirm')} onPress={confirmPhoto} />
                    <Button title={t('camera.retake')} onPress={() => setPhoto(null)} />
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
        justifyContent: 'flex-end',
    },
    buttonContainer: {
        backgroundColor: 'transparent',
        alignSelf: 'center',
        marginBottom: 20,
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    preview: {
        width: '100%',
        height: '80%',
        marginBottom: 20,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 16,
    }
});
