import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Giriş/Kayıt modu değişimi

  async function handleAuth() {
    if (!email || !password)
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");

    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) Alert.alert("Hata", error.message);
      else
        Alert.alert(
          "Başarılı",
          "Onay e-postası gönderildi (veya otomatik giriş yapıldı).",
        );
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) Alert.alert("Hata", error.message);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ArticQR Studio</Text>
      <Text style={styles.subtitle}>
        {isSignUp ? "Yeni bir hesap oluştur" : "Hesabına giriş yap"}
      </Text>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={styles.mainButton}
        onPress={handleAuth}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isSignUp ? "Kayıt Ol" : "Giriş Yap"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setIsSignUp(!isSignUp)}
        style={styles.switchButton}
      >
        <Text style={styles.switchText}>
          {isSignUp
            ? "Zaten hesabın var mı? Giriş yap"
            : "Hesabın yok mu? Hemen kayıt ol"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 30,
    backgroundColor: "#FFF",
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#000",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 40,
  },
  inputArea: { marginBottom: 20 },
  input: {
    backgroundColor: "#F2F2F7",
    height: 60,
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    fontSize: 16,
  },
  mainButton: {
    backgroundColor: "#000",
    height: 60,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  switchButton: { marginTop: 25, alignItems: "center" },
  switchText: { color: "#007AFF", fontWeight: "600" },
});
