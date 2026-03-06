import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
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

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userQrs, setUserQrs] = useState([]);
  const [metin, setMetin] = useState("https://articqr.studio");
  const [tempMetin, setTempMetin] = useState("https://articqr.studio");
  const [qrRengi, setQrRengi] = useState("#000000");
  const [secilenLogo, setSecilenLogo] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [paketModalGorunur, setPaketModalGorunur] = useState(false);
  const [authModalGorunur, setAuthModalGorunur] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [isimModalGorunur, setIsimModalGorunur] = useState(false);
  const [qrIsmi, setQrIsmi] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const qrReferansi = useRef();

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession) {
        await fetchProfile(currentSession.user.id);
        await fetchUserQrs(currentSession.user.id);
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

  const fetchProfile = async (uid) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (data) setUserProfile(data);
    else if (error) console.log("Profil çekme hatası:", error.message);
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
    } catch (error) {
      Alert.alert("Hata", "Sayaç artırılamadı.");
    }
  };

  const qrSil = (item) => {
    Alert.alert(
      "QR Kodu Sil",
      `"${item.title}" adlı QR kodu kalıcı olarak silmek istediğinize emin misiniz?`,
      [
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
            } catch (error) {
              Alert.alert("Hata", "Silinemedi, tekrar deneyin.");
            }
          },
        },
      ],
    );
  };

  const handleAuth = async () => {
    if (!email || !password)
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
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
    } catch (error) {
      Alert.alert("Hata ⚠️", error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  const qrOlustur = () => {
    if (!tempMetin.trim()) {
      Alert.alert("Hata", "Lütfen bir URL veya metin giriniz.");
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
          slug: slug,
        },
      ]);
      if (error) throw error;
      setIsimModalGorunur(false);
      Alert.alert("Başarılı ✨", "Dinamik QR Kod koleksiyonuna eklendi!");
      fetchUserQrs(session.user.id);
    } catch (error) {
      Alert.alert("Hata", "Kaydedilirken bir sorun oluştu.");
    }
  };

  const logoSec = async () => {
    if (
      !session ||
      !userProfile ||
      !userProfile.plan_type ||
      userProfile.plan_type === "free"
    ) {
      Alert.alert(
        "Premium Özellik 🔒",
        "Logo eklemek için Plus plana sahip olmalısınız.",
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Planları Gör", onPress: () => setPaketModalGorunur(true) },
        ],
      );
      return;
    }
    let sonuc = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!sonuc.canceled) setSecilenLogo(sonuc.assets[0].uri);
  };

  const galeriyeKaydet = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") throw new Error("İzin yok");
      const resimYolu = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
      });
      await MediaLibrary.saveToLibraryAsync(resimYolu);
      Alert.alert("Başarılı ✨", "QR Kod galeriye eklendi.");
    } catch (e) {
      Alert.alert("Hata", "Kaydedilemedi.");
    }
  };

  const isLocked =
    !session || !userProfile?.plan_type || userProfile?.plan_type === "free";

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
              style={styles.qrShadowBox}
            >
              <QRCode
                value={metin}
                size={width * 0.55}
                color={qrRengi}
                backgroundColor="white"
                logo={secilenLogo ? { uri: secilenLogo } : null}
                logoSize={60}
                logoBackgroundColor="white"
                logoBorderRadius={12}
                quietZone={10}
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
              onPress={() => setModalGorunur(true)}
            >
              <Text style={styles.actionEmoji}>🎨</Text>
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
                onPress={galeriyeKaydet}
              >
                <Text style={styles.secondaryButtonText}>💾 İndir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={async () => {
                  const uri = await captureRef(qrReferansi, { format: "png" });
                  Sharing.shareAsync(uri);
                }}
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

          {/* MODALLAR (İsim, Renk, Auth, Paket) */}
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

          <Modal
            visible={modalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={styles.bottomSheet}>
                <View style={styles.dragHandle} />
                <Text style={styles.sheetTitle}>Renk Seçimi</Text>
                <View style={styles.pickerBox}>
                  <ColorPicker
                    color={qrRengi}
                    onColorChange={(color) => setQrRengi(color)}
                    thumbSize={28}
                    sliderSize={28}
                    noSnap
                  />
                </View>
                <TouchableOpacity
                  style={styles.closeSheet}
                  onPress={() => setModalGorunur(false)}
                >
                  <Text style={styles.closeSheetText}>TAMAM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

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
                <View style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Plus</Text>
                    <Text style={styles.planPrice}>$4.99/ay</Text>
                  </View>
                  <Text style={styles.planFeature}>• 5 Adet Dinamik QR</Text>
                  <Text style={styles.planFeature}>• Özel Logo Ekleme</Text>
                  <TouchableOpacity
                    style={styles.planButton}
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
                <View
                  style={[
                    styles.planCard,
                    { borderColor: "#007AFF", borderWidth: 2 },
                  ]}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Pro 🔥</Text>
                    <Text style={styles.planPrice}>$9.99/ay</Text>
                  </View>
                  <Text style={styles.planFeature}>• 25 Adet Dinamik QR</Text>
                  <Text style={styles.planFeature}>
                    • Vektörel (SVG/PDF) Çıktı
                  </Text>
                  <TouchableOpacity
                    style={[styles.planButton, { backgroundColor: "#007AFF" }]}
                    onPress={() => {
                      setPaketModalGorunur(false);
                      setIsSignUp(true);
                      setAuthModalGorunur(true);
                    }}
                  >
                    <Text style={styles.planButtonText}>
                      {session ? "PRO'YU SEÇ" : "KAYIT OL VE SEÇ"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Agency</Text>
                    <Text style={styles.planPrice}>$39.00/ay</Text>
                  </View>
                  <Text style={styles.planFeature}>• 200 Adet Dinamik QR</Text>
                  <TouchableOpacity
                    style={styles.planButton}
                    onPress={() => {
                      setPaketModalGorunur(false);
                      setIsSignUp(true);
                      setAuthModalGorunur(true);
                    }}
                  >
                    <Text style={styles.planButtonText}>
                      {session ? "AGENCY'YE GEÇ" : "KAYIT OL VE SEÇ"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

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
    borderRadius: 32,
    elevation: 15,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 25,
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
    gap: 15,
    marginBottom: 20,
  },
  mainAction: {
    backgroundColor: "#F2F2F7",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
    width: width * 0.4,
  },
  actionEmoji: { fontSize: 24 },
  actionText: { fontSize: 13, fontWeight: "bold" },
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
  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
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
  sheetTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  pickerBox: { height: 300, width: "100%" },
  closeSheet: {
    backgroundColor: "#000",
    width: "100%",
    height: 60,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  closeSheetText: { color: "#FFF", fontWeight: "bold" },
});
