import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
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
  const [metin, setMetin] = useState("https://articqr.studio");
  const [tempMetin, setTempMetin] = useState("");
  const [qrRengi, setQrRengi] = useState("#000000");
  const [hexInput, setHexInput] = useState("#000000");
  const [secilenLogo, setSecilenLogo] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  const qrReferansi = useRef();

  // --- SUPABASE VE QR OLUŞTURMA FONKSİYONU ---
  const handleGenerateAndSave = async () => {
    if (!tempMetin) {
      Alert.alert("Uyarı", "Lütfen QR kodun yönlendireceği bir link girin.");
      return;
    }

    setYukleniyor(true);
    Keyboard.dismiss();

    try {
      // 1. Veritabanına Kaydet
      const { data, error } = await supabase
        .from("qrcodes")
        .insert([
          {
            title: "Mobil QR",
            target_url: tempMetin,
            is_dynamic: true,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        // 2. Görseli Güncelle (Dilersen linki dinamik ID ile değiştirebilirsin)
        setMetin(tempMetin);
        Alert.alert("Başarılı ✨", "QR Kod oluşturuldu.");
        console.log("Kaydedilen Veri:", data[0]);
      }
    } catch (error) {
      Alert.alert("Hata", "QR Kod oluşturulamadı. " + error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  const hexGirisiniYonet = (text) => {
    setHexInput(text);
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexRegex.test(text)) {
      setQrRengi(text);
    }
  };

  const logoSec = async () => {
    let sonuc = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!sonuc.canceled) {
      setSecilenLogo(sonuc.assets[0].uri);
    }
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
          <View style={styles.headerContainer}>
            <Text style={styles.brandName}>ArticQR</Text>
            <Text style={styles.tagline}>Geleceğin Tasarım Stüdyosu</Text>
          </View>

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
          </View>

          <View style={styles.modernToolbar}>
            <TouchableOpacity
              style={styles.mainAction}
              onPress={() => setModalGorunur(true)}
            >
              <Text style={styles.actionEmoji}>🎨</Text>
              <Text style={styles.actionText}>Renk & Stil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mainAction} onPress={logoSec}>
              <Text style={styles.actionEmoji}>✨</Text>
              <Text style={styles.actionText}>Logo Ekle</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="İçeriği buraya yazın..."
                onChangeText={setTempMetin}
                value={tempMetin}
                placeholderTextColor="#A0A0A0"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGenerateAndSave}
              disabled={yukleniyor}
            >
              {yukleniyor ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.generateButtonText}>QR OLUŞTUR</Text>
              )}
            </TouchableOpacity>

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={galeriyeKaydet}
              >
                <Text style={styles.secondaryButtonText}>💾 Galeriye At</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={async () => {
                  const uri = await captureRef(qrReferansi, { format: "png" });
                  Sharing.shareAsync(uri);
                }}
              >
                <Text style={styles.secondaryButtonText}>📤 Hemen Paylaş</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Modal
            visible={modalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={styles.bottomSheet}>
                <View style={styles.dragHandle} />
                <Text style={styles.sheetTitle}>Tasarım Özellikleri</Text>
                <View style={styles.hexRow}>
                  <Text style={styles.hexSymbol}>#</Text>
                  <TextInput
                    style={styles.hexField}
                    placeholder="000000"
                    value={hexInput.replace("#", "")}
                    onChangeText={hexGirisiniYonet}
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                  <View
                    style={[styles.colorBubble, { backgroundColor: qrRengi }]}
                  />
                </View>
                <View style={styles.pickerBox}>
                  <ColorPicker
                    color={qrRengi}
                    onColorChange={(color) => {
                      setQrRengi(color);
                      setHexInput(color);
                    }}
                    thumbSize={28}
                    sliderSize={28}
                    noSnap={true}
                  />
                </View>
                <TouchableOpacity
                  style={styles.closeSheet}
                  onPress={() => setModalGorunur(false)}
                >
                  <Text style={styles.closeSheetText}>TAMAMLA</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Styles kısmını aynen korudum, görsel yapı bozulmadı.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingBottom: 40 },
  headerContainer: { alignItems: "center", marginTop: 20, marginBottom: 10 },
  brandName: {
    fontSize: 32,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -1,
  },
  tagline: { fontSize: 14, color: "#888", fontWeight: "500" },
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
  modernToolbar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginBottom: 30,
  },
  mainAction: {
    backgroundColor: "#F2F2F7",
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  actionEmoji: { fontSize: 24, marginBottom: 4 },
  actionText: { fontSize: 13, fontWeight: "bold", color: "#3A3A3C" },
  inputArea: { width: "90%", alignSelf: "center" },
  inputWrapper: {
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingHorizontal: 20,
    height: 65,
    justifyContent: "center",
    marginBottom: 15,
  },
  textInput: { fontSize: 16, fontWeight: "500", color: "#000" },
  generateButton: {
    backgroundColor: "#000",
    height: 65,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  generateButtonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  rowButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  secondaryButton: {
    width: "48%",
    height: 60,
    backgroundColor: "#FFF",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  secondaryButtonText: { fontWeight: "bold", color: "#000" },
  blurOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    alignItems: "center",
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 25 },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 60,
    width: "100%",
    marginBottom: 20,
  },
  hexSymbol: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8E8E93",
    marginRight: 5,
  },
  hexField: { flex: 1, fontSize: 18, fontWeight: "bold", color: "#000" },
  colorBubble: {
    width: 35,
    height: 35,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  pickerBox: { height: 280, width: "100%" },
  closeSheet: {
    backgroundColor: "#007AFF",
    width: "100%",
    height: 65,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },
  closeSheetText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
});
