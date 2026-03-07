import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";

import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import ColorPicker from "react-native-wheel-color-picker";
import { supabase } from "../lib/supabase";

const { width } = Dimensions.get("window");

// --- SABİTLER ---
const PREMIUM_PALETTES = [
  { id: 1, name: "Ocean", colors: ["#2E3192", "#1BFFFF"] },
  { id: 2, name: "Sunset", colors: ["#FF512F", "#DD2476"] },
  { id: 3, name: "Lush", colors: ["#11998e", "#38ef7d"] },
  { id: 4, name: "Royal", colors: ["#8E2DE2", "#4A00E0"] },
  { id: 5, name: "Cyber", colors: ["#000000", "#34C759"] },
];

// Gradyan yönleri
const GRAD_DIRECTIONS = [
  {
    id: "diag",
    label: "Çapraz",
    emoji: "↗️",
    dir: ["0%", "0%", "100%", "100%"],
  },
  {
    id: "horiz",
    label: "Yatay",
    emoji: "↔️",
    dir: ["0%", "50%", "100%", "50%"],
  },
  {
    id: "vert",
    label: "Dikey",
    emoji: "↕️",
    dir: ["50%", "0%", "50%", "100%"],
  },
];

export default function App() {
  // --- AUTH & DATA ---
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userQrs, setUserQrs] = useState([]);

  // --- QR İÇERİK ---
  const [metin, setMetin] = useState("https://articqr.studio");
  const [tempMetin, setTempMetin] = useState("https://articqr.studio");

  // --- TEMEL TASARIM ---
  const [qrRengi, setQrRengi] = useState("#000000");
  const [hexInput, setHexInput] = useState("#000000");
  const [secilenLogo, setSecilenLogo] = useState(null);
  const [kenarYuvarlakligi, setKenarYuvarlakligi] = useState(0);

  // --- GRADIENT ---
  const [isGradient, setIsGradient] = useState(false);
  const [premiumPalet, setPremiumPalet] = useState(null);
  const [ozelGradyanRenk1, setOzelGradyanRenk1] = useState("#FF512F");
  const [ozelGradyanRenk2, setOzelGradyanRenk2] = useState("#DD2476");
  const [hexGrad1, setHexGrad1] = useState("#FF512F");
  const [hexGrad2, setHexGrad2] = useState("#DD2476");
  const [aktifGradyanSlot, setAktifGradyanSlot] = useState(1); // hangi renk seçiliyor

  // --- PATTERN ---
  const [secilenYon, setSecilenYon] = useState(GRAD_DIRECTIONS[0]);

  // --- MODAL GÖRÜNÜRLÜKLERI ---
  const [renkModalGorunur, setRenkModalGorunur] = useState(false);
  const [gradyanModalGorunur, setGradyanModalGorunur] = useState(false);
  const [paketModalGorunur, setPaketModalGorunur] = useState(false);
  const [authModalGorunur, setAuthModalGorunur] = useState(false);
  const [isimModalGorunur, setIsimModalGorunur] = useState(false);
  const [indirModalGorunur, setIndirModalGorunur] = useState(false);

  // --- AUTH FORM ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [qrIsmi, setQrIsmi] = useState("");

  const qrReferansi = useRef();
  const qrSvgRef = useRef();

  // ── HESAPLANAN DEĞERLER ──────────────────────────────────────────────────
  const isLocked =
    !session || !userProfile?.plan_type || userProfile?.plan_type === "free";

  // Aktif gradyan renkleri: palet seçiliyse paletinkiler, değilse özel renkler
  const activeGrad1 = premiumPalet ? premiumPalet[0] : ozelGradyanRenk1;
  const activeGrad2 = premiumPalet ? premiumPalet[1] : ozelGradyanRenk2;

  // Pattern gradient aktif mi?
  const gradyanAktif = !isLocked && isGradient;

  // QR'a giden gradyan direction
  const gradDir = secilenYon.dir;

  // ── INIT ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initialize = async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      setSession(s);
      if (s) {
        await fetchProfile(s.user.id);
        await fetchUserQrs(s.user.id);
      }
    };
    initialize();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          await fetchProfile(newSession.user.id);
          await fetchUserQrs(newSession.user.id);
        } else {
          setUserProfile(null);
          setUserQrs([]);
        }
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  // ── SUPABASE ─────────────────────────────────────────────────────────────
  const fetchProfile = async (uid) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (data) setUserProfile(data);
    else if (error) console.log("Profil hatası:", error.message);
  };

  const fetchUserQrs = async (uid) => {
    const { data } = await supabase
      .from("qrcodes")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setUserQrs(data);
  };

  const testTarama = async (item) => {
    try {
      const { error } = await supabase.rpc("increment_scan_by_slug", {
        target_slug: item.slug,
      });
      if (error) throw error;
      fetchUserQrs(session.user.id);
      Alert.alert("Test Başarılı ✨", `${item.title} için sayaç artırıldı!`);
    } catch {
      Alert.alert("Hata", "Sayaç artırılamadı.");
    }
  };

  const qrSil = (item) => {
    Alert.alert("QR Kodu Sil", `"${item.title}" silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("qrcodes")
              .delete()
              .eq("id", item.id)
              .eq("user_id", session.user.id);
            if (error) throw error;
            fetchUserQrs(session.user.id);
          } catch {
            Alert.alert("Hata", "Silinemedi.");
          }
        },
      },
    ]);
  };

  // ── AUTH ─────────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password)
      return Alert.alert("Hata", "Tüm alanları doldurun.");
    setYukleniyor(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("Başarılı ✨", "Hesabınız oluşturuldu!");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setAuthModalGorunur(false);
      }
    } catch (err) {
      Alert.alert("Hata ⚠️", err.message);
    } finally {
      setYukleniyor(false);
    }
  };

  // ── QR OLUŞTUR & KAYDET ──────────────────────────────────────────────────
  const qrOlustur = () => {
    if (!tempMetin.trim()) {
      Alert.alert("Hata", "URL giriniz.");
      return;
    }
    setMetin(tempMetin);
    Keyboard.dismiss();
  };

  const qrKaydet = () => {
    if (!session) {
      setIsSignUp(true);
      setAuthModalGorunur(true);
      return;
    }
    setQrIsmi("");
    setIsimModalGorunur(true);
  };

  const qrKaydetOnayla = async () => {
    const slug = Math.random().toString(36).substring(2, 8);
    const dinamikUrl = `https://slwtvoyymwyakklinjvr.supabase.co/functions/v1/redirect?s=${slug}`;
    setMetin(dinamikUrl);
    const baslik =
      qrIsmi.trim() || tempMetin.replace("https://", "").split("/")[0];
    try {
      const { error } = await supabase.from("qrcodes").insert([
        {
          user_id: session.user.id,
          title: baslik,
          target_url: tempMetin,
          qr_color: qrRengi,
          slug,
        },
      ]);
      if (error) throw error;
      setIsimModalGorunur(false);
      Alert.alert("Başarılı ✨", "Dinamik QR koleksiyona eklendi!");
      fetchUserQrs(session.user.id);
    } catch {
      Alert.alert("Hata", "Kaydedilemedi.");
    }
  };

  // ── LOGO ─────────────────────────────────────────────────────────────────
  const logoSec = async () => {
    if (isLocked) {
      Alert.alert("Premium Özellik 🔒", "Logo için Plus plan gerekli.", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Planları Gör", onPress: () => setPaketModalGorunur(true) },
      ]);
      return;
    }
    const sonuc = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!sonuc.canceled) setSecilenLogo(sonuc.assets[0].uri);
  };

  // ── İNDİRME ──────────────────────────────────────────────────────────────
  const galeriyeKaydet = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") throw new Error("İzin yok");
      const yol = await captureRef(qrReferansi, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(yol);
      Alert.alert("Başarılı ✨", "PNG galeriye eklendi.");
    } catch {
      Alert.alert("Hata", "Kaydedilemedi.");
    }
  };

  const svgOlarakPaylas = async () => {
    try {
      if (!qrSvgRef.current) throw new Error("SVG ref yok");
      qrSvgRef.current.toDataURL(async (data) => {
        // data: base64 PNG — SVG string için ayrı bir yol gerekir
        // Burada PNG'yi SVG wrapper içine sararak paylaşıyoruz
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="300" height="300"><image href="data:image/png;base64,${data}" width="300" height="300"/></svg>`;
        const fileUri = `${require("expo-file-system").documentDirectory}qr_code.svg`;
        await require("expo-file-system").writeAsStringAsync(
          fileUri,
          svgContent,
          {
            encoding: require("expo-file-system").EncodingType.UTF8,
          },
        );
        await Sharing.shareAsync(fileUri, {
          mimeType: "image/svg+xml",
          UTI: "public.svg-image",
        });
      });
    } catch (e) {
      Alert.alert("Hata", "SVG paylaşılamadı: " + e.message);
    }
  };

  const pdfOlarakPaylas = async () => {
    try {
      const uri = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
        result: "base64",
      });
      const html = `
        <html><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#fff;">
          <img src="data:image/png;base64,${uri}" style="width:300px;height:300px;"/>
        </body></html>`;
      const { uri: pdfUri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      Alert.alert("Hata", "PDF oluşturulamadı: " + e.message);
    }
  };

  const pngOlarakPaylas = async () => {
    const uri = await captureRef(qrReferansi, { format: "png" });
    Sharing.shareAsync(uri);
  };

  // ── RENK YARDIMCILARI ────────────────────────────────────────────────────
  const hexGecerliMi = (hex) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const anaRenkDegistir = (color) => {
    setQrRengi(color);
    setHexInput(color);
  };

  const hexInputOnayla = (val) => {
    const hex = val.startsWith("#") ? val : `#${val}`;
    setHexInput(hex);
    if (hexGecerliMi(hex)) setQrRengi(hex);
  };

  const grad1Degistir = (color) => {
    setOzelGradyanRenk1(color);
    setHexGrad1(color);
    setPremiumPalet(null);
  };

  const grad2Degistir = (color) => {
    setOzelGradyanRenk2(color);
    setHexGrad2(color);
    setPremiumPalet(null);
  };

  const hexGrad1Onayla = (val) => {
    const hex = val.startsWith("#") ? val : `#${val}`;
    setHexGrad1(hex);
    if (hexGecerliMi(hex)) {
      setOzelGradyanRenk1(hex);
      setPremiumPalet(null);
    }
  };

  const hexGrad2Onayla = (val) => {
    const hex = val.startsWith("#") ? val : `#${val}`;
    setHexGrad2(hex);
    if (hexGecerliMi(hex)) {
      setOzelGradyanRenk2(hex);
      setPremiumPalet(null);
    }
  };

  const sifirlaDesign = () => {
    setPremiumPalet(null);
    setIsGradient(false);
    setKenarYuvarlakligi(0);
    setSecilenYon(GRAD_DIRECTIONS[0]);
    setOzelGradyanRenk1("#FF512F");
    setOzelGradyanRenk2("#DD2476");
    setHexGrad1("#FF512F");
    setHexGrad2("#DD2476");
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() =>
                session
                  ? Alert.alert(
                      "Profil",
                      `Plan: ${(userProfile?.plan_type || "free").toUpperCase()}\nEmail: ${session.user.email}`,
                      [
                        {
                          text: "Çıkış Yap",
                          onPress: () => {
                            supabase.auth.signOut();
                            setUserProfile(null);
                          },
                          style: "destructive",
                        },
                        { text: "Kapat" },
                      ],
                    )
                  : (setIsSignUp(false), setAuthModalGorunur(true))
              }
            >
              <Text style={{ fontSize: 22 }}>{session ? "👤" : "🔑"}</Text>
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.brandName}>ArticQR</Text>
              <Text style={styles.tagline}>Hızlı, Şık ve Dinamik QR</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* QR PREVIEW */}
          <View style={styles.previewCard}>
            <View
              ref={qrReferansi}
              collapsable={false}
              style={[styles.qrShadowBox, { borderRadius: kenarYuvarlakligi }]}
            >
              <QRCode
                value={metin}
                size={width * 0.55}
                color={premiumPalet ? premiumPalet[0] : qrRengi}
                backgroundColor="white"
                logo={secilenLogo ? { uri: secilenLogo } : null}
                logoSize={60}
                logoBackgroundColor="white"
                logoBorderRadius={12}
                quietZone={10}
                enableLinearGradient={gradyanAktif}
                linearGradient={
                  gradyanAktif ? [activeGrad1, activeGrad2] : [qrRengi, qrRengi]
                }
                gradientDirection={gradDir}
                getRef={(c) => {
                  qrSvgRef.current = c;
                }}
              />
            </View>
            {isLocked && (
              <TouchableOpacity
                style={styles.promoBadge}
                onPress={() => setPaketModalGorunur(true)}
              >
                <Text style={styles.promoText}>
                  💡 Logo ve Dinamik QR için Plus plana geç.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* TOOLBAR */}
          <View style={styles.modernToolbar}>
            <TouchableOpacity
              style={styles.mainAction}
              onPress={() => setRenkModalGorunur(true)}
            >
              <View style={[styles.colorDot, { backgroundColor: qrRengi }]} />
              <Text style={styles.actionText}>Renk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mainAction, isLocked && { opacity: 0.7 }]}
              onPress={logoSec}
            >
              <Text style={styles.actionEmoji}>✨{isLocked ? "🔒" : ""}</Text>
              <Text style={styles.actionText}>Logo</Text>
            </TouchableOpacity>
          </View>

          {/* PREMIUM TASARIM PANELİ */}
          <View style={styles.designSection}>
            <Text style={styles.sectionLabel}>
              PREMIUM TASARIM {isLocked ? "🔒" : ""}
            </Text>

            {/* Gradyan toggle + özel renk */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.styleBtn,
                  isGradient && !isLocked && styles.activeBtn,
                  { flex: 1 },
                  isLocked && { opacity: 0.5 },
                ]}
                onPress={() =>
                  isLocked
                    ? setPaketModalGorunur(true)
                    : setIsGradient(!isGradient)
                }
              >
                <Text>
                  🌈 Gradyan{isLocked ? " 🔒" : isGradient ? " ✓" : ""}
                </Text>
              </TouchableOpacity>

              {isGradient && !isLocked && (
                <TouchableOpacity
                  style={[
                    styles.styleBtn,
                    {
                      flex: 1,
                      borderColor: "#007AFF",
                      backgroundColor: "#E8F2FF",
                    },
                  ]}
                  onPress={() => setGradyanModalGorunur(true)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={[
                        styles.miniColorDot,
                        { backgroundColor: activeGrad1 },
                      ]}
                    />
                    <Text style={{ fontSize: 12, fontWeight: "700" }}>→</Text>
                    <View
                      style={[
                        styles.miniColorDot,
                        { backgroundColor: activeGrad2 },
                      ]}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#007AFF",
                        fontWeight: "700",
                      }}
                    >
                      Düzenle
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Gradyan Yönü — sadece gradyan aktifken göster */}
            {isGradient && !isLocked && (
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { marginBottom: 8, fontSize: 11 },
                  ]}
                >
                  GRADYAN YÖNÜ
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {GRAD_DIRECTIONS.map((y) => (
                    <TouchableOpacity
                      key={y.id}
                      style={[
                        styles.styleBtn,
                        { flex: 1, paddingVertical: 10 },
                        secilenYon.id === y.id && styles.activeBtn,
                      ]}
                      onPress={() => setSecilenYon(y)}
                    >
                      <Text style={{ fontSize: 18 }}>{y.emoji}</Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          marginTop: 2,
                        }}
                      >
                        {y.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Köşe toggle */}
            <TouchableOpacity
              style={[
                styles.styleBtn,
                {
                  marginBottom: 12,
                  alignSelf: "flex-start",
                  paddingHorizontal: 18,
                },
                kenarYuvarlakligi > 0 && !isLocked && styles.activeBtn,
                isLocked && { opacity: 0.5 },
              ]}
              onPress={() =>
                isLocked
                  ? setPaketModalGorunur(true)
                  : setKenarYuvarlakligi(kenarYuvarlakligi === 0 ? 30 : 0)
              }
            >
              <Text>
                {kenarYuvarlakligi > 0
                  ? "🔵 Köşe: Yuvarlatılmış"
                  : "⬛ Köşe: Kare"}
                {isLocked ? " 🔒" : ""}
              </Text>
            </TouchableOpacity>

            {/* Premium Renk Paletleri */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {PREMIUM_PALETTES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.paletteCircle,
                    {
                      borderColor: p.colors[0],
                      opacity: isLocked ? 0.4 : 1,
                      borderWidth: premiumPalet?.[0] === p.colors[0] ? 3 : 2,
                    },
                  ]}
                  onPress={() => {
                    if (isLocked) return setPaketModalGorunur(true);
                    setPremiumPalet(p.colors);
                    setIsGradient(true);
                  }}
                >
                  <View
                    style={[
                      styles.innerCircle,
                      { backgroundColor: p.colors[0] },
                    ]}
                  />
                  <View
                    style={[
                      styles.innerCircle,
                      { backgroundColor: p.colors[1], marginLeft: -10 },
                    ]}
                  />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.resetBtn} onPress={sifirlaDesign}>
                <Text style={{ fontSize: 12, color: "#888" }}>↺ Sıfırla</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* INPUT AREA */}
          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="URL giriniz..."
                onChangeText={setTempMetin}
                value={tempMetin}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity
              style={[styles.dynamicButton, { backgroundColor: "#000" }]}
              onPress={qrOlustur}
            >
              <Text style={[styles.dynamicButtonText, { color: "#FFF" }]}>
                QR KODU OLUŞTUR
              </Text>
            </TouchableOpacity>
            {isLocked && (
              <TouchableOpacity
                style={styles.dynamicButton}
                onPress={() => setPaketModalGorunur(true)}
              >
                <Text style={styles.dynamicButtonText}>
                  ⚡ DİNAMİK QR'A YÜKSELT
                </Text>
              </TouchableOpacity>
            )}
            {session && (
              <TouchableOpacity
                style={[
                  styles.dynamicButton,
                  { backgroundColor: "#34C759", marginBottom: 20 },
                ]}
                onPress={qrKaydet}
              >
                <Text style={styles.dynamicButtonText}>
                  📁 DİNAMİK QR OLUŞTUR VE KAYDET
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setIndirModalGorunur(true)}
              >
                <Text style={styles.secondaryButtonText}>💾 İndir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={pngOlarakPaylas}
              >
                <Text style={styles.secondaryButtonText}>📤 Paylaş</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* KOLEKSİYON LİSTESİ */}
          {session && (
            <View style={styles.dashboardContainer}>
              <View style={styles.dashboardHeaderRow}>
                <Text style={styles.dashboardTitle}>Koleksiyonum</Text>
                <TouchableOpacity onPress={() => fetchUserQrs(session.user.id)}>
                  <Text style={{ color: "#007AFF" }}>Yenile ↻</Text>
                </TouchableOpacity>
              </View>
              {userQrs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ color: "#888" }}>
                    Henüz bir QR kod kaydetmedin.
                  </Text>
                </View>
              ) : (
                userQrs.map((item) => (
                  <View key={item.id} style={styles.qrItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontWeight: "bold", fontSize: 15 }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <View style={styles.scanBadge}>
                        <Text style={styles.scanText}>
                          📊 {item.scans || 0} Tarama
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => {
                          setTempMetin(item.target_url);
                          setMetin(
                            `https://slwtvoyymwyakklinjvr.supabase.co/functions/v1/redirect?s=${item.slug}`,
                          );
                          setQrRengi(item.qr_color || "#000000");
                          setHexInput(item.qr_color || "#000000");
                          Alert.alert(
                            "Yüklendi",
                            "Düzenleme için yukarı aktarıldı.",
                          );
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFF",
                            fontWeight: "bold",
                            fontSize: 12,
                          }}
                        >
                          Düzenle
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.editBtn,
                          { backgroundColor: "#34C759", marginLeft: 5 },
                        ]}
                        onPress={() => testTarama(item)}
                      >
                        <Text
                          style={{
                            color: "#FFF",
                            fontWeight: "bold",
                            fontSize: 12,
                          }}
                        >
                          Test Et
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.editBtn,
                          { backgroundColor: "#FF3B30", marginLeft: 5 },
                        ]}
                        onPress={() => qrSil(item)}
                      >
                        <Text
                          style={{
                            color: "#FFF",
                            fontWeight: "bold",
                            fontSize: 12,
                          }}
                        >
                          Sil
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══════════════════ MODALLAR ═══════════════════ */}

          {/* RENK MODAL */}
          <Modal
            visible={renkModalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View
                style={[
                  styles.bottomSheet,
                  { maxHeight: "90%", paddingHorizontal: 0 },
                ]}
              >
                <View style={[styles.dragHandle, { marginTop: 14 }]} />
                <Text style={[styles.sheetTitle, { paddingHorizontal: 24 }]}>
                  Renk Seçimi
                </Text>
                <ScrollView
                  style={{ width: "100%" }}
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 16,
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={{ height: 320 }}>
                    <ColorPicker
                      color={qrRengi}
                      onColorChange={anaRenkDegistir}
                      thumbSize={28}
                      sliderSize={28}
                      noSnap
                    />
                  </View>
                  {/* Hex Input — picker'ın altında, swatchların altında */}
                  <View
                    style={[styles.hexRow, { marginTop: 16, marginBottom: 8 }]}
                  >
                    <View
                      style={[styles.hexPreview, { backgroundColor: qrRengi }]}
                    />
                    <TextInput
                      style={styles.hexInput}
                      value={hexInput}
                      onChangeText={hexInputOnayla}
                      placeholder="#000000"
                      autoCapitalize="none"
                      maxLength={7}
                    />
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={[
                    styles.closeSheet,
                    { marginHorizontal: 24, marginBottom: 24, width: 240 },
                  ]}
                  onPress={() => setRenkModalGorunur(false)}
                >
                  <Text style={styles.closeSheetText}>TAMAM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* GRADYAN RENK MODAL */}
          <Modal
            visible={gradyanModalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View
                style={[
                  styles.bottomSheet,
                  { maxHeight: "92%", paddingHorizontal: 0 },
                ]}
              >
                <View style={[styles.dragHandle, { marginTop: 14 }]} />
                <Text style={[styles.sheetTitle, { paddingHorizontal: 24 }]}>
                  Gradyan Renkleri
                </Text>

                {/* Slot seçimi — scroll dışında sabit */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 12,
                    paddingHorizontal: 24,
                    width: "100%",
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.gradSlotBtn,
                      aktifGradyanSlot === 1 && styles.gradSlotBtnActive,
                    ]}
                    onPress={() => setAktifGradyanSlot(1)}
                  >
                    <View
                      style={[
                        styles.miniColorDot,
                        {
                          backgroundColor: ozelGradyanRenk1,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.gradSlotLabel,
                        aktifGradyanSlot === 1 && { color: "#FFF" },
                      ]}
                    >
                      Başlangıç
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.gradSlotBtn,
                      aktifGradyanSlot === 2 && styles.gradSlotBtnActive,
                    ]}
                    onPress={() => setAktifGradyanSlot(2)}
                  >
                    <View
                      style={[
                        styles.miniColorDot,
                        {
                          backgroundColor: ozelGradyanRenk2,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.gradSlotLabel,
                        aktifGradyanSlot === 2 && { color: "#FFF" },
                      ]}
                    >
                      Bitiş
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ width: "100%" }}
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 16,
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Color Picker */}
                  <View style={{ height: 300 }}>
                    <ColorPicker
                      color={
                        aktifGradyanSlot === 1
                          ? ozelGradyanRenk1
                          : ozelGradyanRenk2
                      }
                      onColorChange={
                        aktifGradyanSlot === 1 ? grad1Degistir : grad2Degistir
                      }
                      thumbSize={26}
                      sliderSize={26}
                      noSnap
                    />
                  </View>

                  {/* Hex Input */}
                  <View
                    style={[styles.hexRow, { marginTop: 16, marginBottom: 8 }]}
                  >
                    <View
                      style={[
                        styles.hexPreview,
                        {
                          backgroundColor:
                            aktifGradyanSlot === 1
                              ? ozelGradyanRenk1
                              : ozelGradyanRenk2,
                        },
                      ]}
                    />
                    <TextInput
                      style={styles.hexInput}
                      value={aktifGradyanSlot === 1 ? hexGrad1 : hexGrad2}
                      onChangeText={
                        aktifGradyanSlot === 1 ? hexGrad1Onayla : hexGrad2Onayla
                      }
                      placeholder="#FF512F"
                      autoCapitalize="none"
                      maxLength={7}
                    />
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[
                    styles.closeSheet,
                    { marginHorizontal: 24, marginBottom: 24, width: 240 },
                  ]}
                  onPress={() => setGradyanModalGorunur(false)}
                >
                  <Text style={styles.closeSheetText}>TAMAM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* İNDİR MODAL */}
          <Modal
            visible={indirModalGorunur}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={styles.authCard}>
                <Text style={styles.authTitle}>İndir / Paylaş</Text>

                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: "#000" }]}
                  onPress={async () => {
                    setIndirModalGorunur(false);
                    await galeriyeKaydet();
                  }}
                >
                  <Text style={styles.downloadBtnText}>
                    🖼️ PNG olarak kaydet
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.downloadBtn,
                    { backgroundColor: "#FF3B30" },
                    isLocked && { opacity: 0.5 },
                  ]}
                  onPress={async () => {
                    if (isLocked) {
                      setIndirModalGorunur(false);
                      setPaketModalGorunur(true);
                      return;
                    }
                    setIndirModalGorunur(false);
                    await pdfOlarakPaylas();
                  }}
                >
                  <Text style={styles.downloadBtnText}>
                    📄 PDF olarak paylaş{isLocked ? " 🔒" : ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.downloadBtn,
                    { backgroundColor: "#007AFF" },
                    isLocked && { opacity: 0.5 },
                  ]}
                  onPress={async () => {
                    if (isLocked) {
                      setIndirModalGorunur(false);
                      setPaketModalGorunur(true);
                      return;
                    }
                    setIndirModalGorunur(false);
                    await svgOlarakPaylas();
                  }}
                >
                  <Text style={styles.downloadBtnText}>
                    🔷 SVG olarak paylaş{isLocked ? " 🔒" : ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIndirModalGorunur(false)}
                  style={{ marginTop: 15 }}
                >
                  <Text style={{ color: "#888" }}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* İSİM MODAL */}
          <Modal
            visible={isimModalGorunur}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={styles.authCard}>
                <Text style={styles.authTitle}>QR Koda İsim Ver</Text>
                <TextInput
                  style={styles.authInput}
                  placeholder="Örn: Instagram QR..."
                  value={qrIsmi}
                  onChangeText={setQrIsmi}
                  autoFocus
                  maxLength={40}
                />
                <TouchableOpacity
                  style={styles.authMainBtn}
                  onPress={qrKaydetOnayla}
                >
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    💾 KAYDET
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsimModalGorunur(false)}
                  style={{ marginTop: 15 }}
                >
                  <Text style={{ color: "#888" }}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* AUTH MODAL */}
          <Modal
            visible={authModalGorunur}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={styles.authCard}>
                <Text style={styles.authTitle}>
                  {isSignUp ? "Hesap Oluştur" : "Giriş Yap"}
                </Text>
                <TextInput
                  style={styles.authInput}
                  placeholder="E-posta"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.authInput}
                  placeholder="Şifre"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.authMainBtn}
                  onPress={handleAuth}
                >
                  {yukleniyor ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                      {isSignUp ? "Kayıt Ol" : "Giriş Yap"}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsSignUp(!isSignUp)}
                  style={{ marginTop: 15 }}
                >
                  <Text style={{ color: "#007AFF" }}>
                    {isSignUp ? "Giriş Yap" : "Kayıt Ol"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAuthModalGorunur(false)}
                  style={{ marginTop: 15 }}
                >
                  <Text style={{ color: "#888" }}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* PAKET MODAL */}
          <Modal visible={paketModalGorunur} animationType="slide">
            <SafeAreaView style={styles.paywallContainer}>
              <TouchableOpacity
                onPress={() => setPaketModalGorunur(false)}
                style={styles.closePaywall}
              >
                <Text style={{ fontSize: 24, fontWeight: "bold" }}>✕</Text>
              </TouchableOpacity>
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={styles.paywallTitle}>
                  Planını Seç, Markanı Büyüt 🚀
                </Text>
                {[
                  {
                    name: "Plus",
                    price: "$4.99/ay",
                    features: [
                      "• 5 Adet Dinamik QR",
                      "• Özel Logo Ekleme",
                      "• PDF & SVG Çıktı",
                    ],
                    highlight: false,
                  },
                  {
                    name: "Pro 🔥",
                    price: "$9.99/ay",
                    features: [
                      "• 25 Adet Dinamik QR",
                      "• Sıfır Reklam",
                      "• Vektörel Çıktı",
                    ],
                    highlight: true,
                  },
                  {
                    name: "Agency",
                    price: "$39.00/ay",
                    features: [
                      "• 200 Adet Dinamik QR",
                      "• Müşteri Klasörleme",
                      "• Ekip Paylaşımı",
                    ],
                    highlight: false,
                  },
                ].map((plan) => (
                  <View
                    key={plan.name}
                    style={[
                      styles.planCard,
                      plan.highlight && {
                        borderColor: "#007AFF",
                        borderWidth: 2,
                      },
                    ]}
                  >
                    <View style={styles.planHeader}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planPrice}>{plan.price}</Text>
                    </View>
                    {plan.features.map((f) => (
                      <Text key={f} style={styles.planFeature}>
                        {f}
                      </Text>
                    ))}
                    <TouchableOpacity
                      style={[
                        styles.planButton,
                        plan.highlight && { backgroundColor: "#007AFF" },
                      ]}
                      onPress={() => {
                        setPaketModalGorunur(false);
                        setIsSignUp(true);
                        setAuthModalGorunur(true);
                      }}
                    >
                      <Text style={styles.planButtonText}>
                        {session ? "PLANA GEÇ" : "KAYIT OL VE SEÇ"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ── STİLLER ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingBottom: 60 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  profileBtn: { width: 40, height: 40, justifyContent: "center" },
  brandName: { fontSize: 32, fontWeight: "900", color: "#000" },
  tagline: { fontSize: 14, color: "#888" },
  previewCard: { alignItems: "center", marginVertical: 30 },
  qrShadowBox: {
    padding: 18,
    backgroundColor: "#FFF",
    elevation: 15,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 25,
    overflow: "hidden",
  },
  promoBadge: {
    marginTop: 15,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  promoText: { fontSize: 12, color: "#007AFF", fontWeight: "600" },
  modernToolbar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 15,
  },
  mainAction: {
    backgroundColor: "#F2F2F7",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    width: width * 0.28,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  miniColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  actionEmoji: { fontSize: 22 },
  actionText: { fontSize: 12, fontWeight: "bold", marginTop: 2 },
  designSection: { paddingHorizontal: 20, marginBottom: 25 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8E8E93",
    marginBottom: 10,
    letterSpacing: 1,
  },
  styleBtn: {
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  activeBtn: { borderColor: "#007AFF", backgroundColor: "#E8F2FF" },
  paletteCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
    paddingLeft: 8,
  },
  innerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFF",
  },
  resetBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 20,
  },
  inputArea: { width: "90%", alignSelf: "center" },
  inputWrapper: {
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingHorizontal: 20,
    height: 60,
    justifyContent: "center",
    marginBottom: 15,
  },
  textInput: { fontSize: 16 },
  dynamicButton: {
    backgroundColor: "#FFCC00",
    height: 60,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  dynamicButtonText: { fontWeight: "900", color: "#000" },
  rowButtons: { flexDirection: "row", justifyContent: "space-between" },
  secondaryButton: {
    width: "48%",
    height: 55,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  secondaryButtonText: { fontWeight: "bold" },
  dashboardContainer: { paddingHorizontal: 20, marginTop: 30 },
  dashboardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  dashboardTitle: { fontSize: 22, fontWeight: "800" },
  qrItemCard: {
    backgroundColor: "#F9F9F9",
    padding: 15,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  scanBadge: {
    backgroundColor: "#E8F2FF",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 5,
  },
  scanText: { fontSize: 11, color: "#007AFF", fontWeight: "bold" },
  editBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    alignItems: "center",
    width: "100%",
    position: "absolute",
    bottom: 0,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  pickerBox: { height: 260, width: "100%" },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
    width: "100%",
  },
  hexPreview: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  hexInput: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  gradSlotBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
    borderWidth: 1.5,
    borderColor: "transparent",
    justifyContent: "center",
  },
  gradSlotBtnActive: { backgroundColor: "#000", borderColor: "#000" },
  gradSlotLabel: { fontSize: 13, fontWeight: "700", color: "#333" },
  gradPreviewBar: {
    width: "100%",
    height: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  patternGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 20,
    width: "100%",
  },
  patternCell: {
    width: (width - 100) / 3,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  patternCellActive: { borderColor: "#007AFF", backgroundColor: "#E8F2FF" },
  patternEmoji: { fontSize: 28, marginBottom: 4 },
  patternLabel: { fontSize: 11, fontWeight: "700", color: "#333" },
  closeSheet: {
    backgroundColor: "#000",
    width: "100%",
    height: 58,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  closeSheetText: { color: "#FFF", fontWeight: "bold" },
  authCard: {
    backgroundColor: "#FFF",
    width: "85%",
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
  },
  authTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  authInput: {
    backgroundColor: "#F2F2F7",
    width: "100%",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },
  authMainBtn: {
    backgroundColor: "#000",
    width: "100%",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 10,
  },
  downloadBtn: {
    width: "100%",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  downloadBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  paywallContainer: { flex: 1, backgroundColor: "#FFF" },
  closePaywall: { padding: 20, alignSelf: "flex-end" },
  paywallTitle: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 25,
  },
  planCard: {
    backgroundColor: "#F9F9F9",
    padding: 20,
    borderRadius: 25,
    marginBottom: 20,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  planName: { fontSize: 22, fontWeight: "800" },
  planPrice: { fontSize: 18, color: "#007AFF", fontWeight: "700" },
  planFeature: { fontSize: 15, color: "#333", marginBottom: 2 },
  planButton: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 18,
    marginTop: 10,
    alignItems: "center",
  },
  planButtonText: { color: "#FFF", fontWeight: "bold" },
});
