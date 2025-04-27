import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { theme } from '@/constants/theme';

export default function AudioCapture() {
    const router = useRouter();
    const { t }      = useTranslation();
    const scheme     = useColorScheme() ?? 'light';
    const pal        = theme[scheme];

    const recRef     = useRef<Audio.Recording | null>(null);
    const [status,setStatus] = useState<'idle'|'recording'|'saving'>('idle');

    /* ask for permission once */
    useEffect(() => {
        (async () => {
            const p = await Audio.requestPermissionsAsync();
            if (!p.granted) {
                alert('Mic permission denied');           // real app: translate / nicer UI
                // TODO CREATE A THEMED SNACKBAR THAT NO AUDIO PERMISSION AVALIABLE
                router.replace('/(tabs)');
            }
        })();
    }, []);

    /* start / stop helpers */
    const startRec = async () => {
        try{
            setStatus('recording');
            await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:true });
            const rec = new Audio.Recording();
            await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await rec.startAsync();
            recRef.current = rec;
        }catch(e){ console.error(e); setStatus('idle'); }
    };

    const stopRec  = async () => {
        if(!recRef.current) return;
        setStatus('saving');
        try{
            await recRef.current.stopAndUnloadAsync();
            const uri = recRef.current.getURI()!;
            /* send the file-URI back to manual.tsx ------------- */
            router.push({ pathname:'/log/manual', params:{ audioUri: uri }});
        }catch(e){ console.error(e); setStatus('idle'); }
    };

    /* UI */
    if(status==='saving'){
        return (
            <View style={[styles.center,{backgroundColor:pal.colors.background}]}>
                <ActivityIndicator size="large" color={pal.colors.primary}/>
                <Text style={{color:pal.colors.text.primary,marginTop:12}}>{t('audio.saving')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.center,{backgroundColor:pal.colors.background}]}>
            {status==='idle' && (
                <Pressable style={[styles.btn,{backgroundColor:pal.colors.primary}]}
                           onPress={startRec}>
                    <Text style={[styles.txt,{color:pal.colors.text.light}]}>{t('audio.start')}</Text>
                </Pressable>
            )}
            {status==='recording' && (
                <Pressable style={[styles.btn,{backgroundColor:pal.colors.error}]}
                           onPress={stopRec}>
                    <Text style={[styles.txt,{color:pal.colors.text.light}]}>{t('audio.stop')}</Text>
                </Pressable>
            )}
        </View>
    );
}

/* basic styling */
const styles = StyleSheet.create({
    center:{ flex:1, justifyContent:'center', alignItems:'center', padding:24 },
    btn   :{ paddingHorizontal:36, paddingVertical:16, borderRadius:28 },
    txt   :{ fontSize:18, fontWeight:'600' },
});
