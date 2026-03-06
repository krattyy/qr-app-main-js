import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
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
import { supabase } from "../lib/supabase";

const { width } = Dimensions.get("window");

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userQrs, setUserQrs] = useState([]);

  // QR KODU TETİKLEYEN ASIL STATE
  const [metin, setMetin] = useState("https://articqr.studio");
  // SADECE INPUT'TA GÖZÜKEN GEÇİCİ STATE
  const [tempMetin, setTempMetin] = useState("https://articqr.studio");

  const [qrRengi, setQrRengi] = useState("#000000");
  const [secilenLogo, setSecilenLogo] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [paketModalGorunur, setPaketModalGorunur] = useState(false);
  const [authModalGorunur, setAuthModalGorunur] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const qrReferansi = useRef();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchUserQrs(session.user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchProfile(session.user.id);
          fetchUserQrs(session.user.id);
        } else {
          setUserProfile(null);
          setUserQrs([]);
        }
      },
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchUserQrs = async (uid) => {
    const { data } = await supabase
      .from("qrcodes")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setUserQrs(data);
  };

  const handleAuth = async () => {
    if (!email || !password)
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    setYukleniyor(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert(
          "Başarılı ✨",
          "Hesabınız oluşturuldu! Şimdi giriş yapabilirsiniz.",
        );
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

  // QR KODU OLUŞTUR / GÜNCELLE BUTONU FONKSİYONU
  const qrOlustur = () => {
    if (!tempMetin.trim()) {
      Alert.alert("Hata", "Lütfen bir URL veya metin giriniz.");
      return;
    }
    setMetin(tempMetin); // QR kod şimdi değişecek
    Keyboard.dismiss(); // Klavyeyi kapat
  };

  const qrKaydet = async () => {
    if (!session) {
      setIsSignUp(true);
      setAuthModalGorunur(true);
      return;
    }

    try {
      const { error } = await supabase.from("qrcodes").insert([
        {
          user_id: session.user.id,
          title: "Yeni QR Kod",
          target_url: metin,
          qr_color: qrRengi,
        },
      ]);
      if (error) throw error;
      Alert.alert("Başarılı ✨", "QR Kod koleksiyonuna eklendi!");
      fetchUserQrs(session.user.id);
    } catch (error) {
      Alert.alert("Hata", "Kaydedilirken bir sorun oluştu.");
    }
  };

  const premiumOzellikKontrol = () => {
    if (!session) {
      Alert.alert(
        "Üyelik Gereklidir",
        "Logo eklemek ve QR kodunuzu takip etmek için ücretsiz üye olmalısınız.",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Üye Ol",
            onPress: () => {
              setIsSignUp(true);
              setAuthModalGorunur(true);
            },
          },
        ],
      );
      return false;
    }
    return true;
  };

  const logoSec = async () => {
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
                      `Plan: ${userProfile?.plan_type?.toUpperCase()}\nEmail: ${session.user.email}`,
                      [
                        {
                          text: "Çıkış Yap",
                          onPress: () => supabase.auth.signOut(),
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
                value={metin} // Sadece butona basınca değişen asıl metin
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
            {!session && (
              <TouchableOpacity
                style={styles.promoBadge}
                onPress={() => {
                  setIsSignUp(true);
                  setAuthModalGorunur(true);
                }}
              >
                <Text style={styles.promoText}>
                  💡 Bu QR'ı daha sonra düzenlemek için ücretsiz üye ol.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ACTIONS */}
          <View style={styles.modernToolbar}>
            <TouchableOpacity
              style={styles.mainAction}
              onPress={() => setModalGorunur(true)}
            >
              <Text style={styles.actionEmoji}>🎨</Text>
              <Text style={styles.actionText}>Renk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mainAction, !session && { opacity: 0.7 }]}
              onPress={() => premiumOzellikKontrol() && logoSec()}
            >
              <Text style={styles.actionEmoji}>✨</Text>
              <Text style={styles.actionText}>Logo {!session && "🔒"}</Text>
            </TouchableOpacity>
          </View>

          {/* INPUT AREA */}
          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="URL giriniz..."
                onChangeText={setTempMetin} // Sadece geçici state'i günceller
                value={tempMetin}
                autoCapitalize="none"
              />
            </View>

            {/* OLUŞTUR BUTONU - QR'ı TETİKLEYEN BU */}
            <TouchableOpacity
              style={[styles.dynamicButton, { backgroundColor: "#000" }]}
              onPress={qrOlustur}
            >
              <Text style={[styles.dynamicButtonText, { color: "#FFF" }]}>
                QR KODU OLUŞTUR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dynamicButton}
              onPress={() => setPaketModalGorunur(true)}
            >
              <Text style={styles.dynamicButtonText}>
                ⚡ DİNAMİK QR'A YÜKSELT
              </Text>
            </TouchableOpacity>

            {session && (
              <TouchableOpacity
                style={[
                  styles.dynamicButton,
                  { backgroundColor: "#34C759", marginBottom: 20 },
                ]}
                onPress={qrKaydet}
              >
                <Text style={styles.dynamicButtonText}>
                  📁 KOLEKSİYONA KAYDET
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={galeriyeKaydet}
              >
                <Text style={styles.secondaryButtonText}>
                  💾 İndir (Reklamlı)
                </Text>
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

          {/* DASHBOARD */}
          {session && userQrs.length > 0 && (
            <View style={styles.dashboardContainer}>
              <Text style={styles.dashboardTitle}>
                Koleksiyonum ({userQrs.length})
              </Text>
              {userQrs.map((item) => (
                <View key={item.id} style={styles.qrItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontWeight: "bold", fontSize: 16 }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{ color: "#888", fontSize: 12 }}
                      numberOfLines={1}
                    >
                      {item.target_url}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        "Düzenle",
                        "Dinamik link değiştirme özelliği yakında!",
                      )
                    }
                  >
                    <Text style={{ color: "#007AFF", fontWeight: "bold" }}>
                      Düzenle
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* MODALLAR (Aynı Şekilde Devam) */}
          {/* ... Modal kodları öncekiyle aynı ... */}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Stiller önceki kodla aynı, sadece dashboard ve input için gerekli olanları koruyun
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
  dashboardTitle: { fontSize: 22, fontWeight: "800", marginBottom: 15 },
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
  planFeature: { fontSize: 15, color: "#333" },
  planButton: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 18,
    marginTop: 15,
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
