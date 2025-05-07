import { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  useColorScheme,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";

import { theme } from "@/constants/theme";
import { getBirdSpottings } from "@/services/database";
import { auth } from "@/firebase/config";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedSnackbar } from "@/components/ThemedSnackbar";
import { BlurView } from "expo-blur";
import { syncDatabase } from "@/services/sync_layer";

type Spotting = {
  id: number;
  bird_type: string;
  date: string;
  text_note?: string;
  image_uri?: string;
};

export default function ArchiveScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const pal = theme[scheme];
  const mode = useColorScheme() ?? "light";

  const [rows, setRows] = useState<Spotting[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"DESC" | "ASC">("DESC");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [online, setOnline] = useState(false);

  const insets = useSafeAreaInsets();

  const [snackbar, setSnackbar] = useState(false);

  const snackbarMsg = t("archive.not_logged_in");

  /* ───────────────────────────── connection */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
      setOnline(s.isConnected ?? false)
    );
    return () => unsub();
  }, []);

  /* ───────────────────────────── permissions */
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== "granted") {
        await MediaLibrary.requestPermissionsAsync(true);
      }
    })();
  }, []);

  /* ───────────────────────────── database read */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setStatus(t("archive.loading"));

        let data = getBirdSpottings(50, sort);
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          data = data.filter(
            (r) =>
              r.bird_type?.toLowerCase().includes(q) ||
              r.date?.toLowerCase().includes(q)
          );
        }
        if (mounted) {
          setRows(data);
          setStatus("");
        }
      } catch (e) {
        console.error(e);
        setStatus(t("archive.load_error"));
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [query, sort, t]);

  /* ───────────────────────────── sync */
  const handleSync = async () => {
    if (!online) return;
    if (!auth.currentUser) {
      setSnackbar(true);
      return;
    }
    try {
      setStatus(t("archive.syncing"));
      await syncDatabase();
      setStatus(t("archive.sync_ok"));

      setLoading(true);
      let data = getBirdSpottings(50, sort);
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        data = data.filter(
          (r) =>
            r.bird_type?.toLowerCase().includes(q) ||
            r.date?.toLowerCase().includes(q)
        );
      }
      setRows(data);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(t("archive.sync_failed"));
    } finally {
      setLoading(false);
    }
  };

  /* row renderer */
  const renderRow = useCallback(
    ({ item }: { item: Spotting }) => (
      <BlurView
        intensity={60}
        tint={mode === "dark" ? "dark" : "light"}
        style={[styles.card, { borderColor: pal.colors.border }]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: "/archive/detail/[id]",
              params: { id: item.id },
            })
          }
        >
          {!!item.image_uri && (
            <Image source={{ uri: item.image_uri }} style={styles.thumb} />
          )}

          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: pal.colors.text.primary }]}>
              {item.bird_type || t("archive.unknown_bird")}
            </Text>
            <Text style={{ color: pal.colors.text.secondary, marginBottom: 2 }}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
            {!!item.text_note && (
              <Text
                style={{ color: pal.colors.text.secondary }}
                numberOfLines={2}
              >
                {item.text_note}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </BlurView>
    ),
    [pal, t]
  );

  /* ───────────────────────────── loading view */
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: pal.colors.background }]}
      >
        <ActivityIndicator size="large" color={pal.colors.primary} />
        {!!status && (
          <Text style={{ color: pal.colors.text.secondary, marginTop: 8 }}>
            {status}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  /* ───────────────────────────── main view */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.colors.background }}>
      {/* Search bar */}
      <View
        style={[
          styles.searchWrap,
          { borderColor: pal.colors.border, marginTop: insets.top + 4 },
        ]}
      >
        <Feather name="search" size={18} color={pal.colors.text.secondary} />
        <TextInput
          style={[styles.input, { color: pal.colors.text.primary }]}
          placeholder={t("archive.search_placeholder")}
          placeholderTextColor={pal.colors.text.secondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Sort & Sync */}
      <View style={styles.buttonsRow}>
        {(["DESC", "ASC"] as const).map((dir) => (
          <Pressable
            key={dir}
            onPress={() => setSort(dir)}
            style={[
              styles.button,
              sort === dir && { backgroundColor: pal.colors.primary },
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color:
                    sort === dir
                      ? pal.colors.text.light
                      : pal.colors.text.primary,
                },
              ]}
            >
              {dir === "DESC"
                ? t("archive.sort_newest")
                : t("archive.sort_oldest")}
            </Text>
          </Pressable>
        ))}
        {online && (
          <Pressable style={styles.button} onPress={handleSync}>
            <Text
              style={[styles.buttonText, { color: pal.colors.text.primary }]}
            >
              {t("archive.sync_now")}
            </Text>
          </Pressable>
        )}
      </View>

      {!!status && (
        <Text
          style={{
            textAlign: "center",
            marginBottom: 6,
            color: pal.colors.text.secondary,
          }}
        >
          {status}
        </Text>
      )}

      {/* List */}
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text
            style={{
              textAlign: "center",
              marginTop: 32,
              color: pal.colors.text.secondary,
            }}
          >
            {t("archive.empty")}
          </Text>
        }
        renderItem={({ item }) => (
          <BlurView
            intensity={60}
            tint={mode === "dark" ? "dark" : "light"}
            style={[styles.cardBlur, { borderColor: pal.colors.border }]}
          >
            <TouchableOpacity
              activeOpacity={0.5}
              style={[styles.card]}
              onPress={() =>
                router.push({
                  pathname: "/archive/detail/[id]",
                  params: { id: item.id },
                })
              }
            >
              {item.image_uri && (
                <Image source={{ uri: item.image_uri }} style={styles.thumb} />
              )}

              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.title, { color: pal.colors.text.primary }]}
                >
                  {item.bird_type || t("archive.unknown_bird")}
                </Text>
                <Text
                  style={{ color: pal.colors.text.secondary, marginBottom: 2 }}
                >
                  {new Date(item.date).toLocaleDateString()}
                </Text>
                {!!item.text_note && (
                  <Text
                    style={{ color: pal.colors.text.secondary }}
                    numberOfLines={2}
                  >
                    {item.text_note}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </BlurView>
        )}
      />
      {/* --- SNACKBAR -------------------------------------------------- */}
      <ThemedSnackbar
        visible={snackbar}
        message={snackbarMsg}
        onHide={() => setSnackbar(false)}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  styles                                                             */
/* ------------------------------------------------------------------ */
const THUMB = 72;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 16, marginLeft: 6 },

  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.md,
  },
  buttonText: { fontSize: 14, fontWeight: "600" },

  card: {
    flexDirection: "row",
  },
  cardBlur: {
    marginBottom: theme.spacing.lg,
    padding: THUMB / 4,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 8,
    marginRight: 14,
    backgroundColor: "#ccc",
  },
  title: { fontSize: 17, fontWeight: "700" },
});
