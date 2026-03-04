import * as ImagePicker from "expo-image-picker"; // Galeri için
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import {
  Alert,
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
import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
} from "reanimated-color-picker";

export default function App() {
  const [metin, setMetin] = useState("https://google.com");
  const [tempMetin, setTempMetin] = useState("");
  const [qrRengi, setQrRengi] = useState("#000000");
  const [secilenLogo, setSecilenLogo] = useState(null); // Logo state'i
  const [modalGorunur, setModalGorunur] = useState(false);

  const qrReferansi = useRef();

  // Galeriden Logo Seçme Fonksiyonu
  const logoSec = async () => {
    let sonuc = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!sonuc.canceled) {
      setSecilenLogo(sonuc.assets[0].uri);
    }
  };

  const qrOlustur = () => {
    if (tempMetin.trim() !== "") {
      setMetin(tempMetin);
      Keyboard.dismiss();
    }
  };

  const galeriyeKaydet = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") return Alert.alert("Hata", "İzin gerekiyor.");
      const resimYolu = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
      });
      await MediaLibrary.saveToLibraryAsync(resimYolu);
      Alert.alert("Başarılı", "QR Kod galeriye kaydedildi!");
    } catch (hata) {
      Alert.alert("Hata", "Kaydetme başarısız.");
    }
  };

  const paylas = async () => {
    const resimYolu = await captureRef(qrReferansi, {
      format: "png",
      quality: 1,
    });
    await Sharing.shareAsync(resimYolu);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.disKutu}>
        <ScrollView
          contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
        >
          <Text style={styles.baslik}>ArticQR Studio</Text>

          {/* QR ALANI */}
          <View ref={qrReferansi} style={styles.qrKutu}>
            <QRCode
              value={metin}
              size={220}
              color={qrRengi}
              backgroundColor="white"
              logo={secilenLogo ? { uri: secilenLogo } : null} // Logo varsa bas
              logoSize={60}
              logoBackgroundColor="white"
              logoBorderRadius={10}
            />
          </View>

          {/* TASARIM BUTONLARI */}
          <View style={styles.tasarimSatiri}>
            <TouchableOpacity
              style={[styles.ayarButonu, { borderColor: qrRengi }]}
              onPress={() => setModalGorunur(true)}
            >
              <Text>🎨 Renk</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ayarButonu} onPress={logoSec}>
              <Text>🖼️ Logo Ekle</Text>
            </TouchableOpacity>

            {secilenLogo && (
              <TouchableOpacity
                style={[styles.ayarButonu, { borderColor: "red" }]}
                onPress={() => setSecilenLogo(null)}
              >
                <Text>❌ Sil</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* RENK SEÇİCİ MODAL */}
          <Modal
            visible={modalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.modalMerkez}>
              <View style={styles.modalIcerik}>
                <ColorPicker
                  value={qrRengi}
                  onComplete={(res) => {
                    // Buraya bir try-catch ekleyerek hatanın uygulamayı kapatmasını engelleyelim
                    try {
                      if (res && res.hex) {
                        setQrRengi(res.hex);
                      }
                    } catch (e) {
                      console.log("Renk seçme hatası:", e);
                    }
                  }}
                >
                  <Panel1 style={styles.panel} />
                  <HueSlider style={styles.slider} />
                  <Preview style={styles.onizlemeKutusu} />
                </ColorPicker>
                <TouchableOpacity
                  style={styles.kapatButonu}
                  onPress={() => setModalGorunur(false)}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    UYGULA
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={styles.formAlt}>
            <TextInput
              style={styles.input}
              placeholder="Link girin..."
              onChangeText={setTempMetin}
              value={tempMetin}
            />
            <TouchableOpacity style={styles.anaButon} onPress={qrOlustur}>
              <Text style={styles.butonYazisi}>QR KODU OLUŞTUR</Text>
            </TouchableOpacity>
            <View style={styles.altButonlar}>
              <TouchableOpacity
                style={styles.islemButonu}
                onPress={galeriyeKaydet}
              >
                <Text>Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.islemButonu} onPress={paylas}>
                <Text>Paylaş</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  disKutu: { flex: 1, backgroundColor: "#fff" },
  baslik: { fontSize: 26, fontWeight: "bold", marginVertical: 20 },
  qrKutu: {
    padding: 15,
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 20,
  },
  tasarimSatiri: { flexDirection: "row", marginBottom: 20, gap: 10 },
  ayarButonu: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "#ddd",
  },
  modalMerkez: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 20,
  },
  modalIcerik: { backgroundColor: "white", borderRadius: 20, padding: 20 },
  panel: { height: 200, marginBottom: 20, borderRadius: 15 },
  slider: { height: 30, marginBottom: 20, borderRadius: 10 },
  onizlemeKutusu: { height: 40, borderRadius: 10, marginBottom: 20 },
  kapatButonu: {
    backgroundColor: "#000",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  formAlt: { width: "90%" },
  input: {
    height: 55,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  anaButon: {
    height: 55,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 15,
  },
  islemButonu: {
    width: "48%",
    height: 50,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  altButonlar: { flexDirection: "row", justifyContent: "space-between" },
  butonYazisi: { color: "white", fontWeight: "bold" },
});
