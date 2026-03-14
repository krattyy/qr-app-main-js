// app/index.js

import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Notifications from "expo-notifications";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCodeGenerator from "qrcode";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Image as SvgImage,
} from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import ColorPicker from "react-native-wheel-color-picker";
import { supabase } from "../lib/supabase";

const { width } = Dimensions.get("window");

const PREMIUM_PALETTES = [
  { id: 1, name: "Ocean", colors: ["#2E3192", "#1BFFFF"] },
  { id: 2, name: "Sunset", colors: ["#FF512F", "#DD2476"] },
  { id: 3, name: "Lush", colors: ["#11998e", "#38ef7d"] },
  { id: 4, name: "Royal", colors: ["#8E2DE2", "#4A00E0"] },
  { id: 5, name: "Cyber", colors: ["#000000", "#34C759"] },
  { id: 6, name: "Peach", colors: ["#F7971E", "#FFD200"] },
];

const GRAD_DIRECTIONS = [
  { id: "diag", label: "Capraz", emoji: "↗️" },
  { id: "horiz", label: "Yatay", emoji: "↔️" },
  { id: "vert", label: "Dikey", emoji: "↕️" },
];

const QR_PATTERNS = [
  { id: "square", label: "Kare", premium: false },
  { id: "rounded", label: "Yuvarlak", premium: false },
  { id: "dots", label: "Nokta", premium: false },
  { id: "soft", label: "Soft", premium: true },
  { id: "classy", label: "Classy", premium: true },
];

const QR_EYES = [
  { id: "square", label: "Kare", premium: false },
  { id: "rounded", label: "Yuvarlak", premium: false },
  { id: "circle", label: "Daire", premium: false },
  { id: "soft", label: "Soft", premium: true },
  { id: "diamond", label: "Diamond", premium: true },
];

const PLAN_LIMITS = {
  free: 3,
  plus: 5,
  pro: 25,
  agency: 200,
};

const THEME = {
  light: {
    bg: "#F7F8FA",
    card: "#FFFFFF",
    card2: "#F7F8FA",
    text: "#111111",
    textSub: "#888888",
    border: "#E5E5EA",
    tabBar: "#FFFFFF",
    input: "#F0F0F5",
    inputText: "#000000",
    placeholder: "#AAAAAA",
  },
  dark: {
    bg: "#000000",
    card: "#1C1C1E",
    card2: "#2C2C2E",
    text: "#FFFFFF",
    textSub: "#AEAEB2",
    border: "#3A3A3C",
    tabBar: "#1C1C1E",
    input: "#2C2C2E",
    inputText: "#FFFFFF",
    placeholder: "#636366",
  },
};

const QUIET_ZONE = 10;
const LOGO_SIZE_RATIO = 0.22;

const getPatternRadius = (pattern, moduleSize) => {
  switch (pattern) {
    case "rounded":
      return moduleSize * 0.35;
    case "soft":
      return moduleSize * 0.22;
    case "classy":
      return moduleSize * 0.18;
    default:
      return 0;
  }
};

const getEyeRadius = (eyeStyle, size) => {
  switch (eyeStyle) {
    case "rounded":
      return size * 0.2;
    case "soft":
      return size * 0.28;
    default:
      return 0;
  }
};

const shouldSkipForLogo = (x, y, moduleSize, qrPixelSize, logoSize) => {
  const qrCenter = qrPixelSize / 2;
  const half = logoSize / 2;
  const padding = moduleSize * 1.2;
  return (
    x < qrCenter + half + padding &&
    x + moduleSize > qrCenter - half - padding &&
    y < qrCenter + half + padding &&
    y + moduleSize > qrCenter - half - padding
  );
};

function QRModule({ x, y, moduleSize, pattern, fill }) {
  if (pattern === "dots") {
    return (
      <Circle
        cx={x + moduleSize / 2}
        cy={y + moduleSize / 2}
        r={moduleSize * 0.38}
        fill={fill}
      />
    );
  }
  if (pattern === "classy") {
    return (
      <Path
        d={`M ${x} ${y + moduleSize * 0.25} Q ${x} ${y} ${x + moduleSize * 0.25} ${y} L ${x + moduleSize} ${y} L ${x + moduleSize} ${y + moduleSize * 0.75} Q ${x + moduleSize} ${y + moduleSize} ${x + moduleSize * 0.75} ${y + moduleSize} L ${x} ${y + moduleSize} Z`}
        fill={fill}
      />
    );
  }
  return (
    <Rect
      x={x}
      y={y}
      width={moduleSize}
      height={moduleSize}
      rx={getPatternRadius(pattern, moduleSize)}
      ry={getPatternRadius(pattern, moduleSize)}
      fill={fill}
    />
  );
}

function QREye({ x, y, moduleSize, eyeStyle, fill }) {
  const outerSize = moduleSize * 7;
  const innerOffset = moduleSize * 2;
  const innerSize = moduleSize * 3;

  if (eyeStyle === "circle") {
    return (
      <G>
        <Circle
          cx={x + outerSize / 2}
          cy={y + outerSize / 2}
          r={outerSize / 2}
          fill={fill}
        />
        <Circle
          cx={x + outerSize / 2}
          cy={y + outerSize / 2}
          r={outerSize / 2 - moduleSize}
          fill="white"
        />
        <Circle
          cx={x + outerSize / 2}
          cy={y + outerSize / 2}
          r={innerSize / 2}
          fill={fill}
        />
      </G>
    );
  }
  if (eyeStyle === "diamond") {
    const cx = x + outerSize / 2;
    const cy = y + outerSize / 2;
    const half = outerSize / 2;
    const innerHalf = innerSize / 2;
    return (
      <G>
        <Path
          d={`M ${cx} ${cy - half} L ${cx + half} ${cy} L ${cx} ${cy + half} L ${cx - half} ${cy} Z`}
          fill={fill}
        />
        <Path
          d={`M ${cx} ${cy - (half - moduleSize)} L ${cx + (half - moduleSize)} ${cy} L ${cx} ${cy + (half - moduleSize)} L ${cx - (half - moduleSize)} ${cy} Z`}
          fill="white"
        />
        <Path
          d={`M ${cx} ${cy - innerHalf} L ${cx + innerHalf} ${cy} L ${cx} ${cy + innerHalf} L ${cx - innerHalf} ${cy} Z`}
          fill={fill}
        />
      </G>
    );
  }
  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={outerSize}
        height={outerSize}
        rx={getEyeRadius(eyeStyle, outerSize)}
        ry={getEyeRadius(eyeStyle, outerSize)}
        fill={fill}
      />
      <Rect
        x={x + moduleSize}
        y={y + moduleSize}
        width={outerSize - moduleSize * 2}
        height={outerSize - moduleSize * 2}
        rx={getEyeRadius(eyeStyle, outerSize - moduleSize * 2)}
        ry={getEyeRadius(eyeStyle, outerSize - moduleSize * 2)}
        fill="white"
      />
      <Rect
        x={x + innerOffset}
        y={y + innerOffset}
        width={innerSize}
        height={innerSize}
        rx={eyeStyle === "square" ? 0 : innerSize * 0.22}
        ry={eyeStyle === "square" ? 0 : innerSize * 0.22}
        fill={fill}
      />
    </G>
  );
}

const StyledQRCode = memo(function StyledQRCode({
  value,
  size,
  solidColor,
  isGradient,
  gradColors,
  gradDir,
  gradyanModu,
  logoUri,
  pattern,
  eyeStyle,
}) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCodeGenerator.create(value || "https://articqr.studio", {
        errorCorrectionLevel: "H",
        margin: 0,
      });
      return { size: qr.modules.size, data: Array.from(qr.modules.data) };
    } catch {
      const qr = QRCodeGenerator.create("https://articqr.studio", {
        errorCorrectionLevel: "H",
        margin: 0,
      });
      return { size: qr.modules.size, data: Array.from(qr.modules.data) };
    }
  }, [value]);

  const qrPixelSize = size;
  const moduleSize = (qrPixelSize - QUIET_ZONE * 2) / matrix.size;
  const logoSize = logoUri ? qrPixelSize * LOGO_SIZE_RATIO : 0;
  const fillRef = isGradient ? "url(#qrGradient)" : solidColor;

  const getFullGradCoords = () => {
    const dirId = gradDir?.[0];
    switch (dirId) {
      case "horiz":
        return { x1: 0, y1: 0, x2: size, y2: 0 };
      case "vert":
        return { x1: 0, y1: 0, x2: 0, y2: size };
      default:
        return { x1: 0, y1: 0, x2: size, y2: size };
    }
  };

  const eyePositions = [
    { x: QUIET_ZONE, y: QUIET_ZONE, type: "tl" },
    {
      x: QUIET_ZONE + moduleSize * (matrix.size - 7),
      y: QUIET_ZONE,
      type: "tr",
    },
    {
      x: QUIET_ZONE,
      y: QUIET_ZONE + moduleSize * (matrix.size - 7),
      type: "bl",
    },
  ];

  const renderGradient = () => {
    if (!isGradient) return null;
    if (gradyanModu === "full") {
      const { x1, y1, x2, y2 } = getFullGradCoords();
      return (
        <LinearGradient
          id="qrGradient"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor={gradColors[0]} />
          <Stop offset="100%" stopColor={gradColors[1]} />
        </LinearGradient>
      );
    }
    return (
      <LinearGradient id="qrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={gradColors[0]} />
        <Stop offset="100%" stopColor={gradColors[1]} />
      </LinearGradient>
    );
  };

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>{renderGradient()}</Defs>
      <Rect x={0} y={0} width={size} height={size} fill="white" />
      {matrix.data.map((filled, index) => {
        if (!filled) return null;
        const row = Math.floor(index / matrix.size);
        const col = index % matrix.size;
        if (row <= 6 && col <= 6) return null;
        if (row <= 6 && col >= matrix.size - 7) return null;
        if (row >= matrix.size - 7 && col <= 6) return null;
        const x = QUIET_ZONE + col * moduleSize;
        const y = QUIET_ZONE + row * moduleSize;
        if (
          logoUri &&
          shouldSkipForLogo(x, y, moduleSize, qrPixelSize, logoSize)
        )
          return null;
        return (
          <QRModule
            key={`m-${row}-${col}`}
            x={x}
            y={y}
            moduleSize={moduleSize}
            pattern={pattern}
            fill={fillRef}
          />
        );
      })}
      {eyePositions.map((eye) => (
        <QREye
          key={eye.type}
          x={eye.x}
          y={eye.y}
          moduleSize={moduleSize}
          eyeStyle={eyeStyle}
          fill={fillRef}
        />
      ))}
      {logoUri ? (
        <G>
          <Rect
            x={size / 2 - logoSize / 2 - moduleSize * 0.8}
            y={size / 2 - logoSize / 2 - moduleSize * 0.8}
            width={logoSize + moduleSize * 1.6}
            height={logoSize + moduleSize * 1.6}
            rx={12}
            ry={12}
            fill="white"
          />
          <SvgImage
            x={size / 2 - logoSize / 2}
            y={size / 2 - logoSize / 2}
            width={logoSize}
            height={logoSize}
            href={{ uri: logoUri }}
            preserveAspectRatio="xMidYMid slice"
          />
        </G>
      ) : null}
    </Svg>
  );
});

function MiniPatternPreview({ pattern, active, dark }) {
  const fill = active ? "#007AFF" : dark ? "#AEAEB2" : "#1C1C1E";
  const bg = active ? "#EAF3FF" : dark ? "#3A3A3C" : "#F5F5F7";
  return (
    <Svg width={42} height={42} viewBox="0 0 42 42">
      <Rect x={0} y={0} width={42} height={42} rx={10} fill={bg} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => {
          const x = 8 + c * 7;
          const y = 8 + r * 7;
          if (pattern === "dots")
            return (
              <Circle
                key={`${r}-${c}`}
                cx={x + 2}
                cy={y + 2}
                r={2}
                fill={fill}
              />
            );
          if (pattern === "classy")
            return (
              <Path
                key={`${r}-${c}`}
                d={`M ${x} ${y + 1.2} Q ${x} ${y} ${x + 1.2} ${y} L ${x + 4} ${y} L ${x + 4} ${y + 2.8} Q ${x + 4} ${y + 4} ${x + 2.8} ${y + 4} L ${x} ${y + 4} Z`}
                fill={fill}
              />
            );
          const rx = pattern === "rounded" ? 1.5 : pattern === "soft" ? 1 : 0;
          return (
            <Rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={4}
              height={4}
              rx={rx}
              ry={rx}
              fill={fill}
            />
          );
        }),
      )}
    </Svg>
  );
}

function MiniEyePreview({ eyeStyle, active, dark }) {
  const fill = active ? "#007AFF" : dark ? "#AEAEB2" : "#1C1C1E";
  const bg = active ? "#EAF3FF" : dark ? "#3A3A3C" : "#F5F5F7";
  return (
    <Svg width={42} height={42} viewBox="0 0 42 42">
      <Rect x={0} y={0} width={42} height={42} rx={10} fill={bg} />
      {eyeStyle === "circle" ? (
        <>
          <Circle cx={21} cy={21} r={12} fill={fill} />
          <Circle cx={21} cy={21} r={8} fill="white" />
          <Circle cx={21} cy={21} r={4} fill={fill} />
        </>
      ) : eyeStyle === "diamond" ? (
        <>
          <Path d="M21 8 L34 21 L21 34 L8 21 Z" fill={fill} />
          <Path d="M21 12.5 L29.5 21 L21 29.5 L12.5 21 Z" fill="white" />
          <Path d="M21 16.5 L25.5 21 L21 25.5 L16.5 21 Z" fill={fill} />
        </>
      ) : (
        <>
          <Rect
            x={9}
            y={9}
            width={24}
            height={24}
            rx={eyeStyle === "square" ? 0 : eyeStyle === "rounded" ? 5 : 7}
            ry={eyeStyle === "square" ? 0 : eyeStyle === "rounded" ? 5 : 7}
            fill={fill}
          />
          <Rect
            x={13}
            y={13}
            width={16}
            height={16}
            rx={eyeStyle === "square" ? 0 : eyeStyle === "rounded" ? 4 : 5}
            ry={eyeStyle === "square" ? 0 : eyeStyle === "rounded" ? 4 : 5}
            fill="white"
          />
          <Rect
            x={17}
            y={17}
            width={8}
            height={8}
            rx={eyeStyle === "square" ? 0 : 2}
            ry={eyeStyle === "square" ? 0 : 2}
            fill={fill}
          />
        </>
      )}
    </Svg>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userQrs, setUserQrs] = useState([]);

  const [metin, setMetin] = useState("https://articqr.studio");
  const [tempMetin, setTempMetin] = useState("https://articqr.studio");

  const [qrRengi, setQrRengi] = useState("#000000");
  const [hexInput, setHexInput] = useState("#000000");
  const [secilenLogo, setSecilenLogo] = useState(null);
  const [kenarYuvarlakligi, setKenarYuvarlakligi] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState("square");
  const [selectedEye, setSelectedEye] = useState("square");

  const [isGradient, setIsGradient] = useState(false);
  const [premiumPalet, setPremiumPalet] = useState(null);
  const [ozelGradyanRenk1, setOzelGradyanRenk1] = useState("#FF512F");
  const [ozelGradyanRenk2, setOzelGradyanRenk2] = useState("#DD2476");
  const [hexGrad1, setHexGrad1] = useState("#FF512F");
  const [hexGrad2, setHexGrad2] = useState("#DD2476");
  const [aktifGradyanSlot, setAktifGradyanSlot] = useState(1);
  const [secilenYon, setSecilenYon] = useState(GRAD_DIRECTIONS[0]);
  const [gradyanModu, setGradyanModu] = useState("full");

  const [renkModalGorunur, setRenkModalGorunur] = useState(false);
  const [gradyanModalGorunur, setGradyanModalGorunur] = useState(false);
  const [paketModalGorunur, setPaketModalGorunur] = useState(false);
  const [authModalGorunur, setAuthModalGorunur] = useState(false);
  const [isimModalGorunur, setIsimModalGorunur] = useState(false);
  const [indirModalGorunur, setIndirModalGorunur] = useState(false);
  const [paylasModalGorunur, setPaylasModalGorunur] = useState(false);
  const [analizModalGorunur, setAnalizModalGorunur] = useState(false);
  const [analizQr, setAnalizQr] = useState(null);
  const [analizData, setAnalizData] = useState(null);
  const [analizYukleniyor, setAnalizYukleniyor] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [qrIsmi, setQrIsmi] = useState("");
  const [duzenlenenQr, setDuzenlenenQr] = useState(null);
  const [seciliQrler, setSeciliQrler] = useState([]); // çoklu seçim
  const [secimModu, setSecimModu] = useState(false); // seçim modu aktif mi
  const [duzenlemeIsmi, setDuzenlemeIsmi] = useState(""); // düzenleme sırasında isim
  const [activeTab, setActiveTab] = useState(1);
  const [designMenuAcik, setDesignMenuAcik] = useState(false);
  const [aramaMetni, setAramaMetni] = useState("");
  const [darkMod, setDarkMod] = useState(false);
  const [beniHatirla, setBeniHatirla] = useState(true);
  const [sozlesmeKabul, setSozlesmeKabul] = useState(false);
  const [sozlesmeModalGorunur, setSozlesmeModalGorunur] = useState(false);
  const [klasorler, setKlasorler] = useState([]);
  const [seciliKlasorId, setSeciliKlasorId] = useState(null);
  const [klasorModalGorunur, setKlasorModalGorunur] = useState(false);
  const [klasorAdi, setKlasorAdi] = useState("");
  const [klasorDuzenlenen, setKlasorDuzenlenen] = useState(null);
  const [qrKlasorModalGorunur, setQrKlasorModalGorunur] = useState(false);
  const [klasorAtanacakQr, setKlasorAtanacakQr] = useState(null);

  const qrReferansi = useRef();
  const scrollViewRef = useRef();

  const t = darkMod ? THEME.dark : THEME.light;
  const isLocked = !session || userProfile?.plan_type === "free";
  const planLimit = PLAN_LIMITS[userProfile?.plan_type] ?? 0;
  const activeGrad1 = premiumPalet ? premiumPalet[0] : ozelGradyanRenk1;
  const activeGrad2 = premiumPalet ? premiumPalet[1] : ozelGradyanRenk2;
  const gradyanAktif = !isLocked && isGradient;
  const gradDir = [secilenYon.id];

  // Üyelik bitiş uyarısı — bitiş tarihi varsa ve 3 gün veya daha az kaldıysa
  const subEndDate = userProfile?.subscription_end_date
    ? new Date(userProfile.subscription_end_date)
    : null;
  const now = new Date();
  const gunKaldi = subEndDate
    ? Math.ceil((subEndDate - now) / (1000 * 60 * 60 * 24))
    : null;
  const uyariGoster =
    gunKaldi !== null &&
    gunKaldi <= 3 &&
    gunKaldi >= -3 &&
    userProfile?.plan_type !== "free";

  useEffect(() => {
    // RevenueCat başlat
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    if (Platform.OS === "ios") {
      Purchases.configure({ apiKey: "test_WhiOjJSIGbYJLQtLYfZHmCvawMl" });
    } else if (Platform.OS === "android") {
      Purchases.configure({ apiKey: "test_WhiOjJSIGbYJLQtLYfZHmCvawMl" });
    }

    const initialize = async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      setSession(s);
      if (s) {
        // RevenueCat'e kullanıcıyı tanıt
        await Purchases.logIn(s.user.id);
        await fetchProfile(s.user.id);
        await fetchUserQrs(s.user.id);
        await fetchKlasorler(s.user.id);
      }
    };
    initialize();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        // INITIAL_SESSION, initialize() tarafından zaten işlendi — çift istek önle
        if (_event === "INITIAL_SESSION") return;
        setSession(newSession);
        if (newSession) {
          await Purchases.logIn(newSession.user.id);
          await fetchProfile(newSession.user.id);
          await fetchUserQrs(newSession.user.id);
          await fetchKlasorler(newSession.user.id);
        } else {
          await Purchases.logOut().catch(() => {});
          setUserProfile(null);
          setUserQrs([]);
          setKlasorler([]);
          setSeciliKlasorId(null);
        }
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchAnalytics = async (qrItem) => {
    setAnalizQr(qrItem);
    setAnalizYukleniyor(true);
    setAnalizData(null);
    setAnalizModalGorunur(true);
    const plan = userProfile?.plan_type || "free";
    try {
      const base = supabase
        .from("scan_logs")
        .select("*")
        .eq("qr_id", qrItem.id);

      // Free: sadece toplam (zaten qrcodes.scans'da var)
      if (plan === "free") {
        setAnalizData({ plan, total: qrItem.scans || 0 });
        setAnalizYukleniyor(false);
        return;
      }

      const { data: logs } = await base;
      if (!logs) {
        setAnalizYukleniyor(false);
        return;
      }

      const total = logs.length;

      // Saatlik dağılım — server tarafında zaten local saat kaydedildi
      const hourly = Array(24).fill(0);
      logs.forEach((l) => {
        if (l.hour !== null) hourly[l.hour]++;
      });

      // Platform (Pro+)
      const platformCount = {};
      logs.forEach((l) => {
        if (l.platform)
          platformCount[l.platform] = (platformCount[l.platform] || 0) + 1;
      });

      // Ülke (Pro+)
      const countryCount = {};
      logs.forEach((l) => {
        if (l.country)
          countryCount[l.country] = (countryCount[l.country] || 0) + 1;
      });

      // Benzersiz ziyaretçi (Pro+)
      const uniqueVisitors = new Set(logs.map((l) => l.ip_hash).filter(Boolean))
        .size;

      // Günlük trend son 30 gün (Pro+)
      const dailyCount = {};
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      logs
        .filter((l) => new Date(l.scanned_at) > thirtyDaysAgo)
        .forEach((l) => {
          const day = l.scanned_at?.slice(0, 10);
          if (day) dailyCount[day] = (dailyCount[day] || 0) + 1;
        });

      // Agency: cihaz tipi, OS, referrer, dil, haftalık gün
      const deviceCount = {};
      const osCount = {};
      const referrerCount = {};
      const langCount = {};
      const dowCount = Array(7).fill(0);
      if (plan === "agency") {
        logs.forEach((l) => {
          if (l.device_type)
            deviceCount[l.device_type] = (deviceCount[l.device_type] || 0) + 1;
          if (l.os_version)
            osCount[l.os_version] = (osCount[l.os_version] || 0) + 1;
          if (l.referrer)
            referrerCount[l.referrer] = (referrerCount[l.referrer] || 0) + 1;
          if (l.language)
            langCount[l.language] = (langCount[l.language] || 0) + 1;
          if (l.day_of_week !== null) dowCount[l.day_of_week]++;
        });
      }

      setAnalizData({
        plan,
        total,
        hourly,
        platformCount,
        countryCount,
        uniqueVisitors,
        dailyCount,
        deviceCount,
        osCount,
        referrerCount,
        langCount,
        dowCount,
      });
    } catch (err) {
      Alert.alert("Hata", "Analiz yuklenemedi.");
    }
    setAnalizYukleniyor(false);
  };

  const fetchProfile = async (uid) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (data) setUserProfile(data);
    // Push token kaydet
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await supabase
          .from("profiles")
          .update({ expo_push_token: token })
          .eq("id", uid);
      }
    } catch {}
  };

  const fetchUserQrs = async (uid) => {
    const { data } = await supabase
      .from("qrcodes")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setUserQrs(data);
  };

  const fetchKlasorler = async (uid) => {
    try {
      const { data } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", uid)
        .order("created_at");
      if (data) setKlasorler(data);
    } catch {}
  };

  const klasorOlustur = async () => {
    if (!klasorAdi.trim() || !session) return;
    try {
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: session.user.id, name: klasorAdi.trim() })
        .select()
        .single();
      if (error) throw error;
      setKlasorler((prev) => [...prev, data]);
      setKlasorAdi("");
      setKlasorModalGorunur(false);
    } catch (err) {
      Alert.alert("Hata", err.message);
    }
  };

  const klasorYendenAdlandir = async () => {
    if (!klasorAdi.trim() || !klasorDuzenlenen) return;
    try {
      const { error } = await supabase
        .from("folders")
        .update({ name: klasorAdi.trim() })
        .eq("id", klasorDuzenlenen.id);
      if (error) throw error;
      setKlasorler((prev) =>
        prev.map((k) =>
          k.id === klasorDuzenlenen.id ? { ...k, name: klasorAdi.trim() } : k,
        ),
      );
      setKlasorAdi("");
      setKlasorDuzenlenen(null);
      setKlasorModalGorunur(false);
    } catch (err) {
      Alert.alert("Hata", err.message);
    }
  };

  const klasorSil = async (klasor) => {
    Alert.alert(
      `"${klasor.name}" Klasörünü Sil`,
      "İçindeki QR kodlara ne yapmak istersiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Tümü'ne Taşı",
          onPress: async () => {
            try {
              await supabase
                .from("qrcodes")
                .update({ folder_id: null })
                .eq("folder_id", klasor.id);
              await supabase.from("folders").delete().eq("id", klasor.id);
              setUserQrs((prev) =>
                prev.map((q) =>
                  q.folder_id === klasor.id ? { ...q, folder_id: null } : q,
                ),
              );
              setKlasorler((prev) => prev.filter((k) => k.id !== klasor.id));
              if (seciliKlasorId === klasor.id) setSeciliKlasorId(null);
            } catch (err) {
              Alert.alert("Hata", err.message);
            }
          },
        },
        {
          text: "QR'ları da Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const idsToDelete = userQrs
                .filter((q) => q.folder_id === klasor.id)
                .map((q) => q.id);
              if (idsToDelete.length > 0) {
                await supabase
                  .from("qrcodes")
                  .delete()
                  .in("id", idsToDelete);
                setUserQrs((prev) =>
                  prev.filter((q) => q.folder_id !== klasor.id),
                );
              }
              await supabase.from("folders").delete().eq("id", klasor.id);
              setKlasorler((prev) => prev.filter((k) => k.id !== klasor.id));
              if (seciliKlasorId === klasor.id) setSeciliKlasorId(null);
            } catch (err) {
              Alert.alert("Hata", err.message);
            }
          },
        },
      ],
    );
  };

  const qrKlasoraDegistir = async (qrId, newFolderId) => {
    try {
      await supabase
        .from("qrcodes")
        .update({ folder_id: newFolderId })
        .eq("id", qrId);
      setUserQrs((prev) =>
        prev.map((q) => (q.id === qrId ? { ...q, folder_id: newFolderId } : q)),
      );
      setQrKlasorModalGorunur(false);
      setKlasorAtanacakQr(null);
    } catch (err) {
      Alert.alert("Hata", err.message);
    }
  };

  const qrSil = (item) => {
    Alert.alert("QR Kodu Sil", `"${item.title}" silinsin mi?`, [
      { text: "Vazgec", style: "cancel" },
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

  const testTarama = async (item) => {
    try {
      const { error } = await supabase.rpc("increment_scan_by_slug", {
        target_slug: item.slug,
      });
      if (error) throw error;
      fetchUserQrs(session.user.id);
      Alert.alert("Test Basarili", `${item.title} icin sayac arttirildi!`);
    } catch {
      Alert.alert("Hata", "Sayac artirilamadi.");
    }
  };

  const handleAuth = async () => {
    if (!email || !password)
      return Alert.alert("Hata", "Tum alanlari doldurun.");
    if (isSignUp && !sozlesmeKabul)
      return Alert.alert(
        "Hata",
        "Devam etmek icin Kullanim Kosullarini kabul etmelisiniz.",
      );
    setYukleniyor(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("Basarili", "Hesabiniz olusturuldu! Giris yapabilirsiniz.");
        setIsSignUp(false);
        setSozlesmeKabul(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setAuthModalGorunur(false);
      }
    } catch (err) {
      Alert.alert("Hata", err.message);
    } finally {
      setYukleniyor(false);
    }
  };

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
    if (duzenlenenQr) {
      qrGuncelle();
      return;
    }
    if (planLimit > 0 && userQrs.length >= planLimit) {
      Alert.alert(
        "Limit Doldu",
        `${userProfile?.plan_type?.toUpperCase()} planinda en fazla ${planLimit} dinamik QR olusturabilirsiniz. Daha fazlasi icin planini yukselt.`,
        [
          { text: "Vazgec", style: "cancel" },
          { text: "Plani Yukselt", onPress: () => setPaketModalGorunur(true) },
        ],
      );
      return;
    }
    setQrIsmi("");
    setIsimModalGorunur(true);
  };

  const qrGuncelle = async () => {
    try {
      const { error } = await supabase
        .from("qrcodes")
        .update({
          title: duzenlemeIsmi.trim() || duzenlenenQr.title,
          target_url: tempMetin,
          qr_color: qrRengi,
          is_gradient: gradyanAktif,
          grad_color1: activeGrad1,
          grad_color2: activeGrad2,
          grad_direction: secilenYon.id,
          grad_mode: gradyanModu,
        })
        .eq("id", duzenlenenQr.id)
        .eq("user_id", session.user.id);
      if (error) throw error;
      setDuzenlenenQr(null);
      setDuzenlemeIsmi("");
      fetchUserQrs(session.user.id);
      Alert.alert("Guncellendi", "QR basariyla guncellendi!");
    } catch (err) {
      Alert.alert("Hata", err?.message || "Guncellenemedi.");
    }
  };

  const topluSil = () => {
    if (seciliQrler.length === 0) return;
    Alert.alert(
      "Secilenleri Sil",
      `${seciliQrler.length} adet QR silinsin mi?`,
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("qrcodes")
                .delete()
                .in("id", seciliQrler)
                .eq("user_id", session.user.id);
              if (error) throw error;
              setSeciliQrler([]);
              setSecimModu(false);
              fetchUserQrs(session.user.id);
            } catch (err) {
              Alert.alert("Hata", err?.message || "Silinemedi.");
            }
          },
        },
      ],
    );
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
          is_gradient: gradyanAktif,
          grad_color1: activeGrad1,
          grad_color2: activeGrad2,
          grad_direction: secilenYon.id,
          grad_mode: gradyanModu,
        },
      ]);
      if (error) throw error;
      setIsimModalGorunur(false);
      Alert.alert("Basarili", "Dinamik QR koleksiyona eklendi!");
      fetchUserQrs(session.user.id);
    } catch (err) {
      Alert.alert(
        "Hata",
        err?.message || JSON.stringify(err) || "Kaydedilemedi.",
      );
    }
  };

  const satinAl = async (planAdi) => {
    try {
      // RevenueCat'ten mevcut teklifleri al
      const offerings = await Purchases.getOfferings();
      if (!offerings.current) {
        Alert.alert("Hata", "Urunler yuklenemedi, lutfen tekrar deneyin.");
        return;
      }

      // Plan adına göre package bul
      const paketMap = {
        plus: "plus_monthly",
        pro: "pro_monthly",
        agency: "agency_monthly",
      };
      const paketId = paketMap[planAdi.toLowerCase()];
      const paket =
        offerings.current.availablePackages.find(
          (p) => p.identifier === paketId,
        ) || offerings.current.availablePackages[0];

      if (!paket) {
        Alert.alert("Hata", "Bu plan su an mevcut degil.");
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(paket);

      // Satın alma başarılı — Supabase'i güncelle
      const aktifPlan =
        Object.keys(customerInfo.entitlements.active)[0] ||
        planAdi.toLowerCase();
      const bitisTarihi = customerInfo.latestExpirationDate;

      await supabase
        .from("profiles")
        .update({
          plan_type: aktifPlan,
          subscription_end_date: bitisTarihi,
        })
        .eq("id", session.user.id);

      // QR'ları tekrar aktif et
      await supabase
        .from("qrcodes")
        .update({ is_active: true, notified_inactive: false })
        .eq("user_id", session.user.id);

      await fetchProfile(session.user.id);
      await fetchUserQrs(session.user.id);
      setPaketModalGorunur(false);
      Alert.alert(
        "Hosgeldin! 🎉",
        `${aktifPlan.toUpperCase()} planina gecildi.`,
      );
    } catch (err) {
      if (!err.userCancelled) {
        Alert.alert("Hata", err.message || "Satin alma basarisiz.");
      }
    }
  };

  const aboneligiGeriYukle = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const aktifEntitlement = Object.keys(customerInfo.entitlements.active)[0];
      if (aktifEntitlement) {
        const bitisTarihi = customerInfo.latestExpirationDate;
        await supabase
          .from("profiles")
          .update({
            plan_type: aktifEntitlement,
            subscription_end_date: bitisTarihi,
          })
          .eq("id", session.user.id);
        await fetchProfile(session.user.id);
        Alert.alert(
          "Basarili",
          `${aktifEntitlement.toUpperCase()} plani geri yuklendi!`,
        );
      } else {
        Alert.alert("Bulunamadi", "Aktif abonelik bulunamadi.");
      }
    } catch (err) {
      Alert.alert("Hata", err.message || "Geri yukleme basarisiz.");
    }
  };

  const logoSec = async () => {
    if (isLocked) {
      Alert.alert("Premium Ozellik", "Logo icin Plus plan gerekli.", [
        { text: "Vazgec", style: "cancel" },
        { text: "Planlari Gor", onPress: () => setPaketModalGorunur(true) },
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

  const galeriyeKaydet = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") throw new Error("Izin yok");
      const yol = await captureRef(qrReferansi, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(yol);
      Alert.alert("Basarili", "PNG galeriye eklendi.");
    } catch {
      Alert.alert("Hata", "Kaydedilemedi.");
    }
  };

  const pngOlarakPaylas = async () => {
    const uri = await captureRef(qrReferansi, { format: "png" });
    await Sharing.shareAsync(uri, { mimeType: "image/png" });
  };

  const svgOlarakPaylas = async () => {
    try {
      const FileSystem = require("expo-file-system");
      const base64 = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
        result: "base64",
      });
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="800"><image href="data:image/png;base64,${base64}" width="800" height="800"/></svg>`;
      const fileUri = FileSystem.documentDirectory + "articqr.svg";
      await FileSystem.writeAsStringAsync(fileUri, svgContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "image/svg+xml",
        UTI: "public.svg-image",
      });
    } catch (e) {
      Alert.alert("Hata", "SVG paylasilamadi: " + e.message);
    }
  };

  const svgOlarakIndir = async () => {
    try {
      const FileSystem = require("expo-file-system");
      const base64 = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
        result: "base64",
      });
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="800"><image href="data:image/png;base64,${base64}" width="800" height="800"/></svg>`;
      const fileUri = FileSystem.documentDirectory + "articqr.svg";
      await FileSystem.writeAsStringAsync(fileUri, svgContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "image/svg+xml",
        UTI: "public.svg-image",
        dialogTitle: "SVG olarak kaydet",
      });
    } catch (e) {
      Alert.alert("Hata", "SVG indirilemedi: " + e.message);
    }
  };

  const pdfOlarakPaylas = async () => {
    try {
      const uri = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
        result: "base64",
      });
      const html = `<html><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#fff;"><img src="data:image/png;base64,${uri}" style="width:300px;height:300px;" /></body></html>`;
      const { uri: pdfUri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      Alert.alert("Hata", `PDF olusturulamadi: ${e.message}`);
    }
  };

  const pdfOlarakIndir = async () => {
    try {
      const uri = await captureRef(qrReferansi, {
        format: "png",
        quality: 1,
        result: "base64",
      });
      const html = `<html><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#fff;"><img src="data:image/png;base64,${uri}" style="width:300px;height:300px;" /></body></html>`;
      const { uri: pdfUri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "PDF olarak kaydet",
      });
    } catch (e) {
      Alert.alert("Hata", `PDF indirilemedi: ${e.message}`);
    }
  };

  const hexGecerliMi = (hex) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const anaRenkDegistir = (color) => {
    setQrRengi(color);
    setHexInput(color);
    setPremiumPalet(null);
    setIsGradient(false);
  };
  const hexInputOnayla = (val) => {
    const hex = val.startsWith("#") ? val : `#${val}`;
    setHexInput(hex);
    if (hexGecerliMi(hex)) {
      setQrRengi(hex);
      setPremiumPalet(null);
      setIsGradient(false);
    }
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
    setSelectedPattern("square");
    setSelectedEye("square");
    setOzelGradyanRenk1("#FF512F");
    setOzelGradyanRenk2("#DD2476");
    setHexGrad1("#FF512F");
    setHexGrad2("#DD2476");
    setGradyanModu("full");
    setQrRengi("#000000");
    setHexInput("#000000");
    setSecilenLogo(null);
  };

  const patternSec = (item) => {
    if (item.premium && isLocked) {
      setPaketModalGorunur(true);
      return;
    }
    setSelectedPattern(item.id);
  };
  const eyeSec = (item) => {
    if (item.premium && isLocked) {
      setPaketModalGorunur(true);
      return;
    }
    setSelectedEye(item.id);
  };

  const aboneligiIptalEt = () => {
    Alert.alert(
      "Üyeliği İptal Et",
      "Aboneliğiniz mevcut dönemin sonunda sona erecek. Devam etmek istiyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal Et",
          style: "destructive",
          onPress: async () => {
            Alert.alert(
              "Bilgi",
              "Aboneliğinizi App Store / Google Play üzerinden iptal edebilirsiniz. Mevcut dönem sonuna kadar erişiminiz devam eder.",
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={styles.tabContent}>
          {/* ===== TAB 1: QR Stüdyosu ===== */}
          {activeTab === 1 && (
            <View style={{ flex: 1, backgroundColor: t.bg }}>
              {/* HEADER */}
              <View style={styles.headerContainer}>
                <View style={styles.brandCenter}>
                  <Text style={[styles.brandName, { color: t.text }]}>
                    ArticQR
                  </Text>
                  <Text style={[styles.tagline, { color: t.textSub }]}>
                    Hizli, Sik ve Dinamik QR
                  </Text>
                </View>
              </View>

              {/* ÜYELİK BİTİŞ UYARISI */}
              {uyariGoster && (
                <TouchableOpacity
                  onPress={() => setPaketModalGorunur(true)}
                  style={[
                    styles.subWarningBanner,
                    { backgroundColor: gunKaldi <= 0 ? "#FFF0F0" : "#FFFBEA" },
                  ]}
                >
                  <Text style={[styles.subWarningIcon]}>
                    {gunKaldi <= 0 ? "🔴" : "⚠️"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.subWarningTitle,
                        { color: gunKaldi <= 0 ? "#FF3B30" : "#B8860B" },
                      ]}
                    >
                      {gunKaldi <= 0
                        ? `Uyeliginiz ${Math.abs(gunKaldi)} gun once bitti`
                        : gunKaldi === 0
                          ? "Uyeliginiz bugun bitiyor"
                          : `Uyeliginize ${gunKaldi} gun kaldi`}
                    </Text>
                    <Text style={styles.subWarningDesc}>
                      {gunKaldi <= 0
                        ? "QR kodlariniz pasif hale geldi. Aktifleştirmek icin uyeliginizi yenileyin."
                        : "Uyeliginizi yenilemezseniz QR kodlariniz pasif hale gelecektir."}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#007AFF",
                      fontWeight: "700",
                    }}
                  >
                    Yenile →
                  </Text>
                </TouchableOpacity>
              )}
              <View style={[styles.previewCard, { backgroundColor: t.card }]}>
                <View
                  ref={qrReferansi}
                  collapsable={false}
                  style={[
                    styles.qrShadowBox,
                    { borderRadius: kenarYuvarlakligi },
                  ]}
                >
                  <StyledQRCode
                    value={metin}
                    size={width * 0.55}
                    solidColor={premiumPalet ? premiumPalet[0] : qrRengi}
                    isGradient={gradyanAktif}
                    gradColors={[activeGrad1, activeGrad2]}
                    gradDir={gradDir}
                    gradyanModu={gradyanModu}
                    logoUri={secilenLogo}
                    pattern={selectedPattern}
                    eyeStyle={selectedEye}
                  />
                  {isLocked && (
                    <View style={styles.qrWatermark}>
                      <Text style={styles.qrWatermarkText}>✦ ArticQR</Text>
                    </View>
                  )}
                </View>
                {isLocked && (
                  <TouchableOpacity
                    style={styles.promoBadge}
                    onPress={() => setPaketModalGorunur(true)}
                  >
                    <Text style={styles.promoText}>
                      Logo, ozel desenler ve ozel gozler icin Plus plana gec.
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* COLLAPSE TOGGLE */}
                <TouchableOpacity
                  style={[
                    styles.collapseToggle,
                    { backgroundColor: t.card, borderColor: t.border },
                  ]}
                  onPress={() => setDesignMenuAcik(!designMenuAcik)}
                >
                  <Text style={[styles.collapseToggleText, { color: t.text }]}>
                    {designMenuAcik
                      ? "▲  QR'ını Özelleştir"
                      : "▼  QR'ını Özelleştir"}
                  </Text>
                </TouchableOpacity>
                {designMenuAcik && (
                  <>
                    {/* TOOLBAR */}
                    <View
                      style={[
                        styles.modernToolbar,
                        { backgroundColor: t.card2 },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.mainAction,
                          {
                            backgroundColor: t.card,
                            borderWidth: 1,
                            borderColor: t.border,
                          },
                        ]}
                        onPress={() => setRenkModalGorunur(true)}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: qrRengi },
                          ]}
                        />
                        <Text style={[styles.actionText, { color: t.text }]}>
                          Renk
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.mainAction,
                          {
                            backgroundColor: t.card,
                            borderWidth: 1,
                            borderColor: t.border,
                          },
                          isLocked && styles.dimmed,
                        ]}
                        onPress={logoSec}
                      >
                        <Text style={styles.actionEmoji}>
                          {isLocked ? "✨🔒" : "✨"}
                        </Text>
                        <Text style={[styles.actionText, { color: t.text }]}>
                          Logo
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.mainAction,
                          {
                            backgroundColor: t.card,
                            borderWidth: 1,
                            borderColor: t.border,
                          },
                        ]}
                        onPress={sifirlaDesign}
                      >
                        <Text style={[styles.actionEmoji, { color: t.text }]}>
                          ↺
                        </Text>
                        <Text style={[styles.actionText, { color: t.text }]}>
                          Sifirla
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* DESEN & GOZLER */}
                    <View
                      style={[
                        styles.designSection,
                        { backgroundColor: t.card },
                      ]}
                    >
                      <Text style={[styles.sectionLabel, { color: t.textSub }]}>
                        DESEN
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.selectorRow}
                      >
                        {QR_PATTERNS.map((item) => {
                          const active = selectedPattern === item.id;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[
                                styles.selectorCard,
                                {
                                  backgroundColor: t.card,
                                  borderColor: t.border,
                                },
                                active && styles.selectorCardActive,
                              ]}
                              onPress={() => patternSec(item)}
                            >
                              <MiniPatternPreview
                                pattern={item.id}
                                active={active}
                                dark={darkMod}
                              />
                              <Text
                                style={[
                                  styles.selectorLabel,
                                  { color: t.text },
                                  active && styles.selectorLabelActive,
                                ]}
                              >
                                {item.label}
                              </Text>
                              {item.premium && isLocked && (
                                <Text style={styles.lockMini}>🔒</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <Text
                        style={[
                          styles.sectionLabel,
                          styles.sectionLabelTopSpacing,
                          { color: t.textSub },
                        ]}
                      >
                        GOZLER
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.selectorRow}
                      >
                        {QR_EYES.map((item) => {
                          const active = selectedEye === item.id;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[
                                styles.selectorCard,
                                {
                                  backgroundColor: t.card,
                                  borderColor: t.border,
                                },
                                active && styles.selectorCardActive,
                              ]}
                              onPress={() => eyeSec(item)}
                            >
                              <MiniEyePreview
                                eyeStyle={item.id}
                                active={active}
                                dark={darkMod}
                              />
                              <Text
                                style={[
                                  styles.selectorLabel,
                                  { color: t.text },
                                  active && styles.selectorLabelActive,
                                ]}
                              >
                                {item.label}
                              </Text>
                              {item.premium && isLocked && (
                                <Text style={styles.lockMini}>🔒</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* PREMIUM TASARIM */}
                    <View
                      style={[
                        styles.designSection,
                        { backgroundColor: t.card },
                      ]}
                    >
                      <Text style={[styles.sectionLabel, { color: t.textSub }]}>
                        {isLocked ? "PREMIUM TASARIM 🔒" : "PREMIUM TASARIM"}
                      </Text>

                      <View style={styles.gradientToggleRow}>
                        <TouchableOpacity
                          style={[
                            styles.styleBtn,
                            { backgroundColor: t.card2, borderColor: t.border },
                            styles.flexOne,
                            isGradient && !isLocked && styles.activeBtn,
                            isLocked && styles.dimmed,
                          ]}
                          onPress={() =>
                            isLocked
                              ? setPaketModalGorunur(true)
                              : setIsGradient(!isGradient)
                          }
                        >
                          <Text
                            style={[styles.styleBtnText, { color: isGradient && !isLocked ? "#007AFF" : t.text }]}
                          >
                            {isLocked
                              ? "🌈 Gradyan 🔒"
                              : isGradient
                                ? "🌈 Gradyan ✓"
                                : "🌈 Gradyan"}
                          </Text>
                        </TouchableOpacity>
                        {isGradient && !isLocked && (
                          <TouchableOpacity
                            style={[
                              styles.styleBtn,
                              {
                                backgroundColor: t.card2,
                                borderColor: t.border,
                              },
                              styles.flexOne,
                              styles.gradientEditBtn,
                            ]}
                            onPress={() => setGradyanModalGorunur(true)}
                          >
                            <View style={styles.gradientEditInner}>
                              <View
                                style={[
                                  styles.miniColorDot,
                                  { backgroundColor: activeGrad1 },
                                ]}
                              />
                              <Text style={styles.arrowText}>→</Text>
                              <View
                                style={[
                                  styles.miniColorDot,
                                  { backgroundColor: activeGrad2 },
                                ]}
                              />
                              <Text style={styles.gradientEditText}>
                                Duzenle
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>

                      {isGradient && !isLocked && (
                        <View style={styles.gradientDirectionWrap}>
                          <Text
                            style={[
                              styles.sectionLabelSmall,
                              { color: t.textSub },
                            ]}
                          >
                            GRADYAN YONU
                          </Text>
                          <View style={styles.gradientDirectionsRow}>
                            {GRAD_DIRECTIONS.map((y) => (
                              <TouchableOpacity
                                key={y.id}
                                style={[
                                  styles.styleBtn,
                                  {
                                    backgroundColor: t.card2,
                                    borderColor: t.border,
                                  },
                                  styles.flexOne,
                                  styles.directionBtn,
                                  secilenYon.id === y.id && styles.activeBtn,
                                ]}
                                onPress={() => setSecilenYon(y)}
                              >
                                <Text style={[styles.directionEmoji, { color: secilenYon.id === y.id ? "#007AFF" : t.text }]}>
                                  {y.emoji}
                                </Text>
                                <Text
                                  style={[
                                    styles.directionLabel,
                                    { color: secilenYon.id === y.id ? "#007AFF" : t.textSub },
                                  ]}
                                >
                                  {y.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {isGradient && !isLocked && (
                        <View style={{ marginBottom: 12 }}>
                          <Text
                            style={[
                              styles.sectionLabelSmall,
                              { color: t.textSub },
                            ]}
                          >
                            GRADYAN MODU
                          </Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              style={[
                                styles.styleBtn,
                                {
                                  backgroundColor: t.card2,
                                  borderColor: t.border,
                                },
                                styles.flexOne,
                                gradyanModu === "full" && styles.activeBtn,
                              ]}
                              onPress={() => setGradyanModu("full")}
                            >
                              <Text style={{ fontSize: 16 }}>🌅</Text>
                              <Text
                                style={[
                                  styles.directionLabel,
                                  { color: gradyanModu === "full" ? "#007AFF" : t.textSub },
                                ]}
                              >
                                Tam QR
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.styleBtn,
                                {
                                  backgroundColor: t.card2,
                                  borderColor: t.border,
                                },
                                styles.flexOne,
                                gradyanModu === "module" && styles.activeBtn,
                              ]}
                              onPress={() => setGradyanModu("module")}
                            >
                              <Text style={{ fontSize: 16 }}>⬛</Text>
                              <Text
                                style={[
                                  styles.directionLabel,
                                  { color: gradyanModu === "module" ? "#007AFF" : t.textSub },
                                ]}
                              >
                                Kare Kare
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.styleBtn,
                          { backgroundColor: t.card2, borderColor: t.border },
                          styles.cornerBtn,
                          kenarYuvarlakligi > 0 &&
                            !isLocked &&
                            styles.activeBtn,
                          isLocked && styles.dimmed,
                        ]}
                        onPress={() =>
                          isLocked
                            ? setPaketModalGorunur(true)
                            : setKenarYuvarlakligi(
                                kenarYuvarlakligi === 0 ? 30 : 0,
                              )
                        }
                      >
                        <Text style={[styles.styleBtnText, { color: kenarYuvarlakligi > 0 && !isLocked ? "#007AFF" : t.text }]}>
                          {kenarYuvarlakligi > 0
                            ? "🔵 Kose: Yuvarlatilmis"
                            : "⬛ Kose: Kare"}
                          {isLocked ? " 🔒" : ""}
                        </Text>
                      </TouchableOpacity>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {PREMIUM_PALETTES.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.paletteCircle,
                              {
                                borderColor: p.colors[0],
                                opacity: isLocked ? 0.4 : 1,
                                borderWidth:
                                  premiumPalet?.[0] === p.colors[0] ? 3 : 2,
                              },
                            ]}
                            onPress={() => {
                              if (isLocked) {
                                setPaketModalGorunur(true);
                                return;
                              }
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
                                {
                                  backgroundColor: p.colors[1],
                                  marginLeft: -10,
                                },
                              ]}
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </>
                )}

                {/* URL INPUT */}
                <View style={[styles.inputArea, { backgroundColor: t.card }]}>
                  {duzenlenenQr && (
                    <View
                      style={[
                        styles.inputWrapper,
                        { marginBottom: 10, backgroundColor: t.input },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.textInput,
                          { backgroundColor: t.input, color: t.inputText },
                        ]}
                        placeholder="QR kod adi..."
                        placeholderTextColor={t.placeholder}
                        value={duzenlemeIsmi}
                        onChangeText={setDuzenlemeIsmi}
                        maxLength={40}
                      />
                    </View>
                  )}
                  <View
                    style={[styles.inputWrapper, { backgroundColor: t.input }]}
                  >
                    <TextInput
                      style={[
                        styles.textInput,
                        { backgroundColor: t.input, color: t.inputText },
                      ]}
                      placeholder="URL giriniz..."
                      placeholderTextColor={t.placeholder}
                      onChangeText={setTempMetin}
                      value={tempMetin}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.dynamicButton, styles.darkButton]}
                    onPress={qrOlustur}
                  >
                    <Text style={[styles.dynamicButtonText, styles.lightText]}>
                      QR KODU OLUSTUR
                    </Text>
                  </TouchableOpacity>
                  {!session && (
                    <TouchableOpacity
                      style={[
                        styles.dynamicButton,
                        { backgroundColor: "#FFCC00", marginBottom: 10 },
                      ]}
                      onPress={() => setPaketModalGorunur(true)}
                    >
                      <Text style={styles.dynamicButtonText}>
                        DINAMIK QR'A YUKSELT
                      </Text>
                    </TouchableOpacity>
                  )}
                  {session && (
                    <TouchableOpacity
                      style={[
                        styles.dynamicButton,
                        {
                          backgroundColor: duzenlenenQr ? "#007AFF" : "#34C759",
                          marginBottom: duzenlenenQr ? 6 : 10,
                        },
                      ]}
                      onPress={qrKaydet}
                    >
                      <Text
                        style={[styles.dynamicButtonText, styles.lightText]}
                      >
                        {duzenlenenQr
                          ? "✏️ DEGISIKLIKLERI KAYDET"
                          : "DINAMIK QR OLUSTUR VE KAYDET"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {duzenlenenQr && (
                    <TouchableOpacity
                      style={[
                        styles.dynamicButton,
                        { backgroundColor: "#F2F2F7", marginBottom: 10 },
                      ]}
                      onPress={() => {
                        setDuzenlenenQr(null);
                        setDuzenlemeIsmi("");
                        sifirlaDesign();
                        setTempMetin("https://articqr.studio");
                        setMetin("https://articqr.studio");
                      }}
                    >
                      <Text style={styles.dynamicButtonText}>
                        ✕ Duzenlemeyi Iptal Et
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.rowButtons}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setIndirModalGorunur(true)}
                    >
                      <Text style={styles.secondaryButtonText}>💾 Indir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setPaylasModalGorunur(true)}
                    >
                      <Text style={styles.secondaryButtonText}>📤 Paylas</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* ===== TAB 0: Koleksiyonum ===== */}
          {activeTab === 0 && (
            <View style={{ flex: 1, backgroundColor: t.bg }}>
              {/* HEADER — centered title */}
              <View
                style={{
                  position: "relative",
                  alignItems: "center",
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={[styles.dashboardTitle, { color: t.text }]}>
                  Koleksiyonum{"  "}
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color:
                        session && userQrs.length >= planLimit && planLimit > 0
                          ? "#FF3B30"
                          : "#007AFF",
                    }}
                  >
                    {session ? userQrs.length : 0}/{session ? planLimit : 0}
                  </Text>
                </Text>
                <View
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 16,
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {secimModu && seciliQrler.length > 0 && (
                    <TouchableOpacity onPress={topluSil}>
                      <Text
                        style={{
                          color: "#FF3B30",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        Sil ({seciliQrler.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setSecimModu(!secimModu);
                      setSeciliQrler([]);
                    }}
                  >
                    <Text
                      style={{
                        color: "#007AFF",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      {secimModu ? "İptal" : "Seç"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bigRefreshBtn}
                    onPress={() => session && fetchUserQrs(session.user.id)}
                  >
                    <Text style={styles.bigRefreshText}>↻</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <FlatList
                data={
                  !session
                    ? []
                    : userQrs.filter((item) => {
                        const matchSearch =
                          aramaMetni.trim() === "" ||
                          item.title
                            .toLowerCase()
                            .includes(aramaMetni.toLowerCase());
                        const matchFolder =
                          seciliKlasorId === null ||
                          item.folder_id === seciliKlasorId;
                        return matchSearch && matchFolder;
                      })
                }
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 24,
                }}
                ListHeaderComponent={
                  <View>
                    {/* Arama */}
                    <View
                      style={[
                        styles.inputWrapper,
                        { marginBottom: 10, backgroundColor: t.input },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.textInput,
                          { backgroundColor: t.input, color: t.inputText },
                        ]}
                        placeholder="QR ara..."
                        placeholderTextColor={t.placeholder}
                        value={aramaMetni}
                        onChangeText={setAramaMetni}
                        clearButtonMode="while-editing"
                      />
                    </View>

                    {/* Klasör Chips */}
                    {session && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 10 }}
                        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.klasorChip,
                            { backgroundColor: t.input, borderColor: t.border },
                            seciliKlasorId === null && styles.klasorChipActive,
                          ]}
                          onPress={() => setSeciliKlasorId(null)}
                        >
                          <Text
                            style={[
                              styles.klasorChipText,
                              { color: t.textSub },
                              seciliKlasorId === null &&
                                styles.klasorChipTextActive,
                            ]}
                          >
                            📂 Tümü
                          </Text>
                        </TouchableOpacity>
                        {klasorler.map((k) => (
                          <View key={k.id} style={{ flexDirection: "row", alignItems: "center" }}>
                          <TouchableOpacity
                            style={[
                              styles.klasorChip,
                              {
                                backgroundColor: t.input,
                                borderColor: t.border,
                              },
                              seciliKlasorId === k.id &&
                                styles.klasorChipActive,
                            ]}
                            onPress={() =>
                              setSeciliKlasorId(
                                k.id === seciliKlasorId ? null : k.id,
                              )
                            }
                            onLongPress={() => {
                              setKlasorDuzenlenen(k);
                              setKlasorAdi(k.name);
                              setKlasorModalGorunur(true);
                            }}
                          >
                            <Text
                              style={[
                                styles.klasorChipText,
                                { color: t.textSub },
                                seciliKlasorId === k.id &&
                                  styles.klasorChipTextActive,
                              ]}
                            >
                              📁 {k.name}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => klasorSil(k)}
                            style={{
                              marginLeft: -6,
                              backgroundColor: "#FF3B30",
                              borderRadius: 10,
                              width: 18,
                              height: 18,
                              alignItems: "center",
                              justifyContent: "center",
                              alignSelf: "center",
                            }}
                          >
                            <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "900", lineHeight: 12 }}>×</Text>
                          </TouchableOpacity>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.klasorChipAdd}
                          onPress={() => {
                            setKlasorDuzenlenen(null);
                            setKlasorAdi("");
                            setKlasorModalGorunur(true);
                          }}
                        >
                          <Text style={styles.klasorChipAddText}>+ Klasör</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    )}

                    {/* Seçim modu */}
                    {secimModu && (
                      <TouchableOpacity
                        onPress={() => {
                          if (seciliQrler.length === userQrs.length)
                            setSeciliQrler([]);
                          else setSeciliQrler(userQrs.map((q) => q.id));
                        }}
                        style={{ alignSelf: "flex-end", marginBottom: 8 }}
                      >
                        <Text style={{ color: "#007AFF", fontWeight: "700" }}>
                          {seciliQrler.length === userQrs.length
                            ? "Seçimi Kaldır"
                            : "Tümünü Seç"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {!session && (
                      <View style={{ paddingTop: 40 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: t.textSub,
                            marginBottom: 16,
                            textAlign: "center",
                          }}
                        >
                          Koleksiyonu görmek için giriş yapın
                        </Text>
                        <TouchableOpacity
                          style={[styles.dynamicButton, { width: "100%" }]}
                          onPress={() => {
                            setIsSignUp(false);
                            setAuthModalGorunur(true);
                          }}
                        >
                          <Text style={styles.dynamicButtonText}>
                            Giriş Yap
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {session && userQrs.length === 0 && (
                      <View style={styles.emptyState}>
                        <Text>Henüz bir QR kod kaydetmedin.</Text>
                      </View>
                    )}
                  </View>
                }
                removeClippedSubviews
                maxToRenderPerBatch={6}
                initialNumToRender={8}
                windowSize={8}
                renderItem={({ item }) => {
                  const secili = seciliQrler.includes(item.id);
                  return (
                    <TouchableOpacity
                      activeOpacity={secimModu ? 0.7 : 1}
                      onPress={() => {
                        if (!secimModu) return;
                        setSeciliQrler((prev) =>
                          secili
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id],
                        );
                      }}
                      onLongPress={() => {
                        if (!secimModu) {
                          setSecimModu(true);
                          setSeciliQrler([item.id]);
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.qrItemCard,
                          { backgroundColor: t.card2 },
                          secili && {
                            borderWidth: 2,
                            borderColor: "#007AFF",
                            backgroundColor: "#EAF3FF",
                          },
                        ]}
                      >
                        {secimModu && (
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              borderWidth: 2,
                              borderColor: secili ? "#007AFF" : "#CCC",
                              backgroundColor: secili ? "#007AFF" : "#FFF",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            {secili && (
                              <Text
                                style={{
                                  color: "#FFF",
                                  fontSize: 13,
                                  fontWeight: "900",
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </View>
                        )}
                        <View
                          style={[
                            styles.qrItemLeft,
                            { justifyContent: "center" },
                          ]}
                        >
                          <Text
                            style={[styles.qrItemTitle, { color: t.text }]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 6,
                              alignItems: "center",
                              marginTop: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            <Text
                              style={[styles.scanText, { color: t.textSub }]}
                            >
                              📊 {item.scans || 0} Tarama
                            </Text>
                            {item.is_active === false && (
                              <Text
                                style={[styles.scanText, { color: "#FF3B30" }]}
                              >
                                🔴 Pasif
                              </Text>
                            )}
                            {item.folder_id && (
                              <Text
                                style={[styles.scanText, { color: "#8E8E93" }]}
                              >
                                📁{" "}
                                {klasorler.find((k) => k.id === item.folder_id)
                                  ?.name || ""}
                              </Text>
                            )}
                          </View>
                        </View>
                        {!secimModu && (
                          <View style={{ flexDirection: "column", gap: 5, marginLeft: 8 }}>
                            <View style={{ flexDirection: "row", gap: 5 }}>
                              <TouchableOpacity
                                style={[styles.editBtnSm, { backgroundColor: "#5856D6" }]}
                                onPress={() => fetchAnalytics(item)}
                              >
                                <Text style={styles.editBtnText}>📊</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.editBtnSm}
                                onPress={() => {
                                  setTempMetin(item.target_url || "https://articqr.studio");
                                  setMetin(`https://slwtvoyymwyakklinjvr.supabase.co/functions/v1/redirect?s=${item.slug}`);
                                  setQrRengi(item.qr_color || "#000000");
                                  setHexInput(item.qr_color || "#000000");
                                  setSelectedPattern(item.pattern_type || "square");
                                  setSelectedEye(item.eye_type || "square");
                                  setIsGradient(item.is_gradient || false);
                                  if (item.grad_color1) { setOzelGradyanRenk1(item.grad_color1); setHexGrad1(item.grad_color1); }
                                  if (item.grad_color2) { setOzelGradyanRenk2(item.grad_color2); setHexGrad2(item.grad_color2); }
                                  if (item.grad_direction) setSecilenYon(GRAD_DIRECTIONS.find((d) => d.id === item.grad_direction) || GRAD_DIRECTIONS[0]);
                                  if (item.grad_mode) setGradyanModu(item.grad_mode);
                                  setPremiumPalet(null);
                                  setDuzenlenenQr(item);
                                  setDuzenlemeIsmi(item.title || "");
                                  setActiveTab(1);
                                }}
                              >
                                <Text style={[styles.editBtnText, { fontSize: 9 }]}>✏️</Text>
                              </TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: "row", gap: 5 }}>
                              <TouchableOpacity
                                style={[styles.editBtnSm, { backgroundColor: "#34C759" }]}
                                onPress={() => { setKlasorAtanacakQr(item); setQrKlasorModalGorunur(true); }}
                              >
                                <Text style={styles.editBtnText}>📁</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.editBtnSm, { backgroundColor: "#FF3B30" }]}
                                onPress={() => qrSil(item)}
                              >
                                <Text style={[styles.editBtnText, { fontSize: 9 }]}>🗑️</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {/* ===== TAB 2: Profil ===== */}
          {activeTab === 2 && (
            <ScrollView
              style={{ backgroundColor: t.bg }}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingHorizontal: 24, paddingTop: 24 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {!session ? (
                <View style={{ alignItems: "center", paddingTop: 60 }}>
                  <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: t.text,
                      marginBottom: 8,
                    }}
                  >
                    Henüz giriş yapmadınız
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.dynamicButton,
                      { width: "100%", marginTop: 16 },
                    ]}
                    onPress={() => {
                      setIsSignUp(false);
                      setAuthModalGorunur(true);
                    }}
                  >
                    <Text style={styles.dynamicButtonText}>Giriş Yap</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dynamicButton,
                      {
                        backgroundColor: "#FFCC00",
                        width: "100%",
                        marginTop: 8,
                      },
                    ]}
                    onPress={() => {
                      setIsSignUp(true);
                      setAuthModalGorunur(true);
                    }}
                  >
                    <Text style={styles.dynamicButtonText}>Kayıt Ol</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Avatar + Email */}
                  <View style={{ alignItems: "center", marginBottom: 24 }}>
                    <View
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 38,
                        backgroundColor: "#1C1C1E",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                        shadowColor: "#000",
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 32,
                          color: "#fff",
                          fontWeight: "800",
                        }}
                      >
                        {session?.user?.email?.[0]?.toUpperCase() || "?"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: t.text,
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}
                    >
                      {session?.user?.email}
                    </Text>
                  </View>

                  {/* Plan bilgisi */}
                  <View
                    style={{
                      width: "100%",
                      backgroundColor: t.card2,
                      borderRadius: 20,
                      padding: 18,
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom:
                          subEndDate && userProfile?.plan_type !== "free"
                            ? 14
                            : 0,
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            fontSize: 11,
                            color: t.textSub,
                            fontWeight: "700",
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          AKTİF PLAN
                        </Text>
                        <Text
                          style={{
                            fontSize: 22,
                            fontWeight: "900",
                            color: t.text,
                          }}
                        >
                          {(userProfile?.plan_type || "free")
                            .charAt(0)
                            .toUpperCase() +
                            (userProfile?.plan_type || "free").slice(1)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: "#1C1C1E",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>
                          {userProfile?.plan_type === "agency"
                            ? "🏢"
                            : userProfile?.plan_type === "pro"
                              ? "⚡"
                              : userProfile?.plan_type === "plus"
                                ? "✨"
                                : "🆓"}
                        </Text>
                      </View>
                    </View>

                    {subEndDate && userProfile?.plan_type !== "free" && (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: "#EBEBEB",
                          paddingTop: 14,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: t.textSub,
                            fontWeight: "600",
                          }}
                        >
                          Bitiş Tarihi
                        </Text>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color:
                                gunKaldi !== null && gunKaldi <= 3
                                  ? "#FF3B30"
                                  : "#34C759",
                            }}
                          >
                            {subEndDate.toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </Text>
                          {gunKaldi !== null && gunKaldi > 0 && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: "#999",
                                marginTop: 2,
                              }}
                            >
                              {gunKaldi} gün kaldı
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                    {!subEndDate && userProfile?.plan_type !== "free" && (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: "#EBEBEB",
                          paddingTop: 12,
                          marginTop: 12,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: "#AAAAAA" }}>
                          Bitiş tarihi belirlenmemiş
                        </Text>
                      </View>
                    )}

                    {userProfile?.plan_type === "free" && (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: "#EBEBEB",
                          paddingTop: 12,
                          marginTop: 12,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: "#AAAAAA" }}>
                          Dinamik QR için plan yükselt
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* QR Kullanımı */}
                  {userProfile?.plan_type !== "free" && (
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: t.card2,
                        borderRadius: 20,
                        padding: 18,
                        marginBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: t.textSub,
                            fontWeight: "700",
                            letterSpacing: 0.5,
                          }}
                        >
                          QR KULLANIMI
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color:
                              userQrs.length >= planLimit ? "#FF3B30" : t.text,
                          }}
                        >
                          {userQrs.length} / {planLimit}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 8,
                          backgroundColor: "#E5E5EA",
                          borderRadius: 4,
                        }}
                      >
                        <View
                          style={{
                            height: 8,
                            borderRadius: 4,
                            width: `${Math.min((userQrs.length / planLimit) * 100, 100)}%`,
                            backgroundColor:
                              userQrs.length >= planLimit
                                ? "#FF3B30"
                                : "#1C1C1E",
                          }}
                        />
                      </View>
                      <Text
                        style={{ fontSize: 12, color: "#AAAAAA", marginTop: 8 }}
                      >
                        {planLimit - userQrs.length > 0
                          ? `${planLimit - userQrs.length} adet daha oluşturabilirsiniz`
                          : "Limite ulaştınız"}
                      </Text>
                    </View>
                  )}

                  {/* Planı Yükselt */}
                  {userProfile?.plan_type === "free" && (
                    <TouchableOpacity
                      style={{
                        width: "100%",
                        backgroundColor: "#FFCC00",
                        borderRadius: 20,
                        paddingVertical: 18,
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                      onPress={() => {
                        setPaketModalGorunur(true);
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "800",
                          color: "#111",
                          fontSize: 15,
                        }}
                      >
                        Planı Yükselt ✨
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Dark Mode Toggle */}
                  <View
                    style={{
                      width: "100%",
                      backgroundColor: t.card2,
                      borderRadius: 20,
                      padding: 18,
                      marginBottom: 12,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 15, fontWeight: "700", color: t.text }}
                    >
                      Karanlık Mod
                    </Text>
                    <TouchableOpacity
                      style={{
                        width: 52,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: darkMod ? "#007AFF" : "#E5E5EA",
                        justifyContent: "center",
                        paddingHorizontal: 2,
                      }}
                      onPress={() => setDarkMod(!darkMod)}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: "#FFF",
                          alignSelf: darkMod ? "flex-end" : "flex-start",
                        }}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Üyeliği İptal Et */}
                  {userProfile?.plan_type !== "free" && (
                    <TouchableOpacity
                      style={{
                        width: "100%",
                        backgroundColor: "#FFF8F0",
                        borderRadius: 20,
                        paddingVertical: 18,
                        alignItems: "center",
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: "#FFD9B0",
                      }}
                      onPress={aboneligiIptalEt}
                    >
                      <Text
                        style={{
                          fontWeight: "800",
                          color: "#FF9500",
                          fontSize: 15,
                        }}
                      >
                        Üyeliği İptal Et
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Çıkış Yap */}
                  <TouchableOpacity
                    style={{
                      width: "100%",
                      backgroundColor: "#FFF0F0",
                      borderRadius: 20,
                      paddingVertical: 18,
                      alignItems: "center",
                      marginBottom: 30,
                      borderWidth: 1,
                      borderColor: "#FFDADA",
                    }}
                    onPress={() => {
                      supabase.auth.signOut();
                      setUserProfile(null);
                      setActiveTab(1);
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "800",
                        color: "#FF3B30",
                        fontSize: 15,
                      }}
                    >
                      Çıkış Yap
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}

          {/* ANALİTİK MODAL */}
          <Modal
            visible={analizModalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View
                style={[
                  styles.bottomSheet,
                  {
                    paddingHorizontal: 0,
                    paddingBottom: 0,
                    maxHeight: "92%",
                    backgroundColor: t.card,
                  },
                ]}
              >
                <View style={[styles.dragHandle, { marginTop: 14 }]} />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    marginTop: 12,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={[
                      styles.sheetTitle,
                      { marginBottom: 0, flex: 1, color: t.text },
                    ]}
                  >
                    📊 {analizQr?.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAnalizModalGorunur(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={{ fontSize: 20, color: "#AAA", fontWeight: "300" }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={{ width: "100%" }}
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 40,
                  }}
                >
                  {analizYukleniyor ? (
                    <ActivityIndicator
                      size="large"
                      color="#007AFF"
                      style={{ marginTop: 40 }}
                    />
                  ) : analizData ? (
                    <>
                      {/* Toplam + Benzersiz */}
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          marginBottom: 16,
                          marginTop: 8,
                        }}
                      >
                        <View
                          style={[
                            styles.analizKart,
                            { backgroundColor: t.card2 },
                          ]}
                        >
                          <Text style={[styles.analizSayi, { color: t.text }]}>
                            {analizData.total}
                          </Text>
                          <Text
                            style={[styles.analizLabel, { color: t.textSub }]}
                          >
                            Toplam Tarama
                          </Text>
                        </View>
                        {analizData.plan !== "free" &&
                          analizData.plan !== "plus" && (
                            <View
                              style={[
                                styles.analizKart,
                                { backgroundColor: t.card2 },
                              ]}
                            >
                              <Text
                                style={[styles.analizSayi, { color: t.text }]}
                              >
                                {analizData.uniqueVisitors || 0}
                              </Text>
                              <Text
                                style={[
                                  styles.analizLabel,
                                  { color: t.textSub },
                                ]}
                              >
                                Benzersiz Ziyaretçi
                              </Text>
                            </View>
                          )}
                      </View>

                      {/* Free lock */}
                      {analizData.plan === "free" && (
                        <TouchableOpacity
                          style={styles.analizLock}
                          onPress={() => {
                            setAnalizModalGorunur(false);
                            setPaketModalGorunur(true);
                          }}
                        >
                          <Text style={{ fontSize: 32, marginBottom: 8 }}>
                            🔒
                          </Text>
                          <Text
                            style={{
                              fontWeight: "800",
                              fontSize: 16,
                              color: "#111",
                              marginBottom: 4,
                            }}
                          >
                            Detaylı Analiz
                          </Text>
                          <Text
                            style={{
                              color: "#888",
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            Saatlik dağılım, platform ve daha fazlası için Plus
                            plana geç
                          </Text>
                          <View
                            style={{
                              backgroundColor: "#007AFF",
                              borderRadius: 14,
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              marginTop: 14,
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "700" }}>
                              Plus'a Geç →
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* Saatlik dağılım (Plus+) */}
                      {analizData.hourly && (
                        <View
                          style={[
                            styles.analizSection,
                            { backgroundColor: t.card2 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.analizSectionTitle,
                              { color: t.text },
                            ]}
                          >
                            Saatlik Dağılım
                          </Text>
                          {/* Barlar */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "flex-end",
                              height: 80,
                              gap: 2,
                            }}
                          >
                            {analizData.hourly.map((val, i) => {
                              const max = Math.max(...analizData.hourly, 1);
                              const h = Math.max(
                                (val / max) * 72,
                                val > 0 ? 6 : 2,
                              );
                              const isActive = val > 0;
                              return (
                                <View
                                  key={i}
                                  style={{
                                    flex: 1,
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    height: "100%",
                                  }}
                                >
                                  {isActive && (
                                    <Text
                                      style={{
                                        fontSize: 7,
                                        color: "#007AFF",
                                        fontWeight: "800",
                                        marginBottom: 1,
                                      }}
                                    >
                                      {val}
                                    </Text>
                                  )}
                                  <View
                                    style={{
                                      width: "100%",
                                      height: h,
                                      backgroundColor: isActive
                                        ? "#007AFF"
                                        : "#E5E5EA",
                                      borderRadius: 3,
                                    }}
                                  />
                                </View>
                              );
                            })}
                          </View>
                          {/* X ekseni etiketleri — barlarla tam hizalı */}
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 2,
                              marginTop: 4,
                            }}
                          >
                            {analizData.hourly.map((_, i) => (
                              <View
                                key={i}
                                style={{ flex: 1, alignItems: "center" }}
                              >
                                {i % 3 === 0 && (
                                  <Text
                                    style={[
                                      styles.analizAxisLabel,
                                      { color: t.textSub },
                                    ]}
                                  >
                                    {String(i).padStart(2, "0")}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Platform (Pro+) */}
                      {analizData.plan !== "free" &&
                        analizData.plan !== "plus" &&
                        analizData.platformCount && (
                          <View
                            style={[
                              styles.analizSection,
                              { backgroundColor: t.card2 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.analizSectionTitle,
                                { color: t.text },
                              ]}
                            >
                              Platform
                            </Text>
                            {Object.entries(analizData.platformCount)
                              .sort((a, b) => b[1] - a[1])
                              .map(([k, v]) => (
                                <View key={k} style={styles.analizRow}>
                                  <Text
                                    style={[
                                      styles.analizRowLabel,
                                      { color: t.text },
                                    ]}
                                  >
                                    {k === "iOS"
                                      ? "🍎 iOS"
                                      : k === "Android"
                                        ? "🤖 Android"
                                        : "💻 Web"}
                                  </Text>
                                  <View
                                    style={{ flex: 1, marginHorizontal: 10 }}
                                  >
                                    <View
                                      style={{
                                        height: 8,
                                        backgroundColor: "#E5E5EA",
                                        borderRadius: 4,
                                      }}
                                    >
                                      <View
                                        style={{
                                          height: 8,
                                          borderRadius: 4,
                                          backgroundColor: "#007AFF",
                                          width: `${Math.round((v / analizData.total) * 100)}%`,
                                        }}
                                      />
                                    </View>
                                  </View>
                                  <Text
                                    style={[
                                      styles.analizRowVal,
                                      { color: t.text },
                                    ]}
                                  >
                                    {Math.round((v / analizData.total) * 100)}%
                                  </Text>
                                </View>
                              ))}
                          </View>
                        )}

                      {/* Ülke (Pro+) */}
                      {analizData.plan !== "free" &&
                        analizData.plan !== "plus" &&
                        analizData.countryCount && (
                          <View
                            style={[
                              styles.analizSection,
                              { backgroundColor: t.card2 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.analizSectionTitle,
                                { color: t.text },
                              ]}
                            >
                              Ülke
                            </Text>
                            {Object.entries(analizData.countryCount)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([k, v]) => (
                                <View key={k} style={styles.analizRow}>
                                  <Text
                                    style={[
                                      styles.analizRowLabel,
                                      { color: t.text },
                                    ]}
                                  >
                                    {k || "Bilinmiyor"}
                                  </Text>
                                  <View
                                    style={{ flex: 1, marginHorizontal: 10 }}
                                  >
                                    <View
                                      style={{
                                        height: 8,
                                        backgroundColor: "#E5E5EA",
                                        borderRadius: 4,
                                      }}
                                    >
                                      <View
                                        style={{
                                          height: 8,
                                          borderRadius: 4,
                                          backgroundColor: "#34C759",
                                          width: `${Math.round((v / analizData.total) * 100)}%`,
                                        }}
                                      />
                                    </View>
                                  </View>
                                  <Text
                                    style={[
                                      styles.analizRowVal,
                                      { color: t.text },
                                    ]}
                                  >
                                    {v}
                                  </Text>
                                </View>
                              ))}
                          </View>
                        )}

                      {/* Agency: Cihaz, OS, Referrer, Dil */}
                      {analizData.plan === "agency" && (
                        <>
                          <View style={styles.analizSection}>
                            <Text style={styles.analizSectionTitle}>
                              Cihaz Tipi
                            </Text>
                            {Object.entries(analizData.deviceCount)
                              .sort((a, b) => b[1] - a[1])
                              .map(([k, v]) => (
                                <View key={k} style={styles.analizRow}>
                                  <Text
                                    style={[
                                      styles.analizRowLabel,
                                      { color: t.text },
                                    ]}
                                  >
                                    {k === "Mobile"
                                      ? "📱 Mobil"
                                      : k === "Tablet"
                                        ? "📟 Tablet"
                                        : "🖥 Masaüstü"}
                                  </Text>
                                  <View
                                    style={{ flex: 1, marginHorizontal: 10 }}
                                  >
                                    <View
                                      style={{
                                        height: 8,
                                        backgroundColor: "#E5E5EA",
                                        borderRadius: 4,
                                      }}
                                    >
                                      <View
                                        style={{
                                          height: 8,
                                          borderRadius: 4,
                                          backgroundColor: "#FF9500",
                                          width: `${Math.round((v / analizData.total) * 100)}%`,
                                        }}
                                      />
                                    </View>
                                  </View>
                                  <Text
                                    style={[
                                      styles.analizRowVal,
                                      { color: t.text },
                                    ]}
                                  >
                                    {v}
                                  </Text>
                                </View>
                              ))}
                          </View>

                          <View style={styles.analizSection}>
                            <Text style={styles.analizSectionTitle}>
                              İşletim Sistemi
                            </Text>
                            {Object.entries(analizData.osCount)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([k, v]) => (
                                <View key={k} style={styles.analizRow}>
                                  <Text
                                    style={[
                                      styles.analizRowLabel,
                                      { color: t.text },
                                    ]}
                                  >
                                    {k}
                                  </Text>
                                  <View
                                    style={{ flex: 1, marginHorizontal: 10 }}
                                  >
                                    <View
                                      style={{
                                        height: 8,
                                        backgroundColor: "#E5E5EA",
                                        borderRadius: 4,
                                      }}
                                    >
                                      <View
                                        style={{
                                          height: 8,
                                          borderRadius: 4,
                                          backgroundColor: "#5856D6",
                                          width: `${Math.round((v / analizData.total) * 100)}%`,
                                        }}
                                      />
                                    </View>
                                  </View>
                                  <Text
                                    style={[
                                      styles.analizRowVal,
                                      { color: t.text },
                                    ]}
                                  >
                                    {v}
                                  </Text>
                                </View>
                              ))}
                          </View>

                          {Object.keys(analizData.referrerCount).length > 0 && (
                            <View style={styles.analizSection}>
                              <Text style={styles.analizSectionTitle}>
                                Kaynak (Referrer)
                              </Text>
                              {Object.entries(analizData.referrerCount)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 5)
                                .map(([k, v]) => (
                                  <View key={k} style={styles.analizRow}>
                                    <Text
                                      style={[
                                        styles.analizRowLabel,
                                        { color: t.text },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {k}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.analizRowVal,
                                        { color: t.text },
                                      ]}
                                    >
                                      {v}
                                    </Text>
                                  </View>
                                ))}
                            </View>
                          )}

                          <View style={styles.analizSection}>
                            <Text style={styles.analizSectionTitle}>
                              Haftalık Gün Dağılımı
                            </Text>
                            {[
                              "Paz",
                              "Pzt",
                              "Sal",
                              "Çar",
                              "Per",
                              "Cum",
                              "Cmt",
                            ].map((gun, i) => {
                              const max = Math.max(...analizData.dowCount, 1);
                              return (
                                <View key={i} style={styles.analizRow}>
                                  <Text
                                    style={[
                                      styles.analizRowLabel,
                                      { color: t.text },
                                    ]}
                                  >
                                    {gun}
                                  </Text>
                                  <View
                                    style={{ flex: 1, marginHorizontal: 10 }}
                                  >
                                    <View
                                      style={{
                                        height: 8,
                                        backgroundColor: "#E5E5EA",
                                        borderRadius: 4,
                                      }}
                                    >
                                      <View
                                        style={{
                                          height: 8,
                                          borderRadius: 4,
                                          backgroundColor: "#FF2D55",
                                          width: `${Math.round((analizData.dowCount[i] / max) * 100)}%`,
                                        }}
                                      />
                                    </View>
                                  </View>
                                  <Text
                                    style={[
                                      styles.analizRowVal,
                                      { color: t.text },
                                    ]}
                                  >
                                    {analizData.dowCount[i]}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </>
                      )}

                      {/* Plus lock — Pro özellikler */}
                      {analizData.plan === "plus" && (
                        <TouchableOpacity
                          style={styles.analizLock}
                          onPress={() => {
                            setAnalizModalGorunur(false);
                            setPaketModalGorunur(true);
                          }}
                        >
                          <Text style={{ fontSize: 28, marginBottom: 8 }}>
                            ⚡
                          </Text>
                          <Text
                            style={{
                              fontWeight: "800",
                              fontSize: 15,
                              color: "#111",
                              marginBottom: 4,
                            }}
                          >
                            Pro Analitik
                          </Text>
                          <Text
                            style={{
                              color: "#888",
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            Platform, ülke ve benzersiz ziyaretçi için Pro plana
                            geç
                          </Text>
                          <View
                            style={{
                              backgroundColor: "#007AFF",
                              borderRadius: 14,
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              marginTop: 14,
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "700" }}>
                              Pro'ya Geç →
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          </Modal>

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
                  {
                    maxHeight: "90%",
                    paddingHorizontal: 0,
                    backgroundColor: t.card,
                  },
                ]}
              >
                <View style={[styles.dragHandle, { marginTop: 14 }]} />
                <Text
                  style={[
                    styles.sheetTitle,
                    { paddingHorizontal: 24, color: t.text },
                  ]}
                >
                  Renk Secimi
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
                  <View
                    style={[styles.hexRow, { marginTop: 16, marginBottom: 8 }]}
                  >
                    <View
                      style={[styles.hexPreview, { backgroundColor: qrRengi }]}
                    />
                    <TextInput
                      style={[
                        styles.hexInput,
                        { backgroundColor: t.input, color: t.inputText },
                      ]}
                      value={hexInput}
                      onChangeText={hexInputOnayla}
                      placeholder="#000000"
                      placeholderTextColor={t.placeholder}
                      autoCapitalize="none"
                      maxLength={7}
                    />
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={[
                    styles.closeSheet,
                    { marginHorizontal: 24, marginBottom: 24, width: 200 },
                  ]}
                  onPress={() => setRenkModalGorunur(false)}
                >
                  <Text style={styles.closeSheetText}>TAMAM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* GRADYAN MODAL */}
          <Modal
            visible={gradyanModalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View
                style={[
                  styles.bottomSheet,
                  {
                    maxHeight: "92%",
                    paddingHorizontal: 0,
                    backgroundColor: t.card,
                  },
                ]}
              >
                <View style={[styles.dragHandle, { marginTop: 14 }]} />
                <Text style={[styles.sheetTitle, { paddingHorizontal: 24 }]}>
                  Gradyan Renkleri
                </Text>
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
                      Baslangic
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
                      Bitis
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
                    { marginHorizontal: 24, marginBottom: 24, width: "auto" },
                  ]}
                  onPress={() => setGradyanModalGorunur(false)}
                >
                  <Text style={styles.closeSheetText}>TAMAM</Text>
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
              <View style={[styles.authCard, { backgroundColor: t.card }]}>
                <Text style={[styles.authTitle, { color: t.text }]}>
                  {isSignUp ? "Hesap Oluştur" : "Giriş Yap"}
                </Text>
                <TextInput
                  style={[
                    styles.authInput,
                    { backgroundColor: t.input, color: t.inputText },
                  ]}
                  placeholder="E-posta"
                  placeholderTextColor={t.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={[
                    styles.authInput,
                    { backgroundColor: t.input, color: t.inputText },
                  ]}
                  placeholder="Şifre"
                  placeholderTextColor={t.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {/* Beni Hatırla — sadece giriş ekranında */}
                {!isSignUp && (
                  <TouchableOpacity
                    onPress={() => setBeniHatirla(!beniHatirla)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      marginBottom: 14,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        borderWidth: 2,
                        borderColor: beniHatirla ? "#007AFF" : "#CCC",
                        backgroundColor: beniHatirla ? "#007AFF" : "#FFF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {beniHatirla && (
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 12,
                            fontWeight: "900",
                          }}
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{ fontSize: 13, color: "#444", fontWeight: "600" }}
                    >
                      Beni Hatırla
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Kullanım Koşulları — sadece kayıt ekranında */}
                {isSignUp && (
                  <TouchableOpacity
                    onPress={() => setSozlesmeKabul(!sozlesmeKabul)}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      alignSelf: "flex-start",
                      marginBottom: 14,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        marginTop: 1,
                        borderWidth: 2,
                        borderColor: sozlesmeKabul ? "#007AFF" : "#CCC",
                        backgroundColor: sozlesmeKabul ? "#007AFF" : "#FFF",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {sozlesmeKabul && (
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 12,
                            fontWeight: "900",
                          }}
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#444",
                        fontWeight: "600",
                        flex: 1,
                      }}
                    >
                      <Text
                        onPress={() => setSozlesmeModalGorunur(true)}
                        style={{
                          color: "#007AFF",
                          textDecorationLine: "underline",
                        }}
                      >
                        Kullanım Koşullarını
                      </Text>{" "}
                      ve{" "}
                      <Text
                        onPress={() => setSozlesmeModalGorunur(true)}
                        style={{
                          color: "#007AFF",
                          textDecorationLine: "underline",
                        }}
                      >
                        Gizlilik Politikasını
                      </Text>{" "}
                      okudum, kabul ediyorum.
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.authMainBtn,
                    isSignUp && !sozlesmeKabul && { opacity: 0.5 },
                  ]}
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
                  onPress={() => {
                    setIsSignUp(!isSignUp);
                    setSozlesmeKabul(false);
                  }}
                  style={{ marginTop: 15 }}
                >
                  <Text style={{ color: "#007AFF" }}>
                    {isSignUp
                      ? "Zaten hesabın var mı? Giriş Yap"
                      : "Hesabın yok mu? Kayıt Ol"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAuthModalGorunur(false)}
                  style={{ marginTop: 12 }}
                >
                  <Text style={{ color: "#888" }}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* KULLANIM KOŞULLARI MODAL */}
          <Modal
            visible={sozlesmeModalGorunur}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View
                style={[
                  styles.authCard,
                  { maxHeight: "82%", width: "92%", backgroundColor: t.card },
                ]}
              >
                <Text
                  style={[styles.authTitle, { marginBottom: 4, color: t.text }]}
                >
                  Kullanım Koşulları
                </Text>
                <Text
                  style={{ fontSize: 11, color: t.textSub, marginBottom: 12 }}
                >
                  Son güncelleme: Mart 2025
                </Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                >
                  {[
                    [
                      "1. Kabul",
                      "ArticQR'ı kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız uygulamayı kullanmayınız.",
                    ],
                    [
                      "2. Hizmet Tanımı",
                      "ArticQR, kullanıcıların dinamik ve statik QR kod oluşturmasına, yönetmesine ve analiz etmesine olanak tanır. Hizmet, üyelik planları kapsamında sunulur.",
                    ],
                    [
                      "3. Hesap Güvenliği",
                      "Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmayın. Hesabınızda yetkisiz bir kullanım tespit etmeniz durumunda bize derhal bildirin.",
                    ],
                    [
                      "4. Yasak İçerikler",
                      "Aşağıdaki içerikler kesinlikle yasaktır ve hesabınızın anında kapatılmasına yol açar:\n• Cinsel, müstehcen veya pornografik içerikler\n• Nefret söylemi, ırkçılık, ayrımcılık\n• Şiddet, terör veya yasadışı faaliyetleri teşvik eden içerikler\n• Telif hakkı ihlali içeren materyaller\n• Yanıltıcı veya sahte içerikler",
                    ],
                    [
                      "5. Zararlı QR Kullanımı",
                      "ArticQR aracılığıyla kötü amaçlı yazılım, kimlik avı (phishing), dolandırıcılık veya kullanıcıları zarara uğratacak herhangi bir bağlantı paylaşmak kesinlikle yasaktır. Bu tür kullanımlar tespit edildiğinde hesap kapatılır ve yasal yollara başvurulabilir.",
                    ],
                    [
                      "6. Bot ve Otomatik Kullanım",
                      "Sistemimize bot, otomatik tarayıcı veya yapay tarama trafiği göndermek yasaktır. Anormal tarama örüntüleri tespit edildiğinde hesabınız askıya alınabilir.",
                    ],
                    [
                      "7. Logo ve Görsel Yükleme",
                      "Yüklediğiniz logo ve görsellerin telif hakkına sahip olduğunuzu ya da kullanım iznine sahip olduğunuzu beyan edersiniz. Cinsel içerikli, şiddet içeren veya hakaret niteliğindeki görseller yasaktır.",
                    ],
                    [
                      "8. Sorumluluk Sınırı",
                      'ArticQR, kullanıcıların oluşturduğu QR kodlarının içeriğinden sorumlu değildir. Hizmet "olduğu gibi" sunulmaktadır. Kesintisiz erişim garanti edilmez.',
                    ],
                    [
                      "9. Değişiklikler",
                      "Bu koşullar önceden bildirim yapılmaksızın güncellenebilir. Güncel versiyona uygulama içinden erişebilirsiniz.",
                    ],
                    ["10. İletişim", "Sorularınız için: destek@articqr.studio"],
                  ].map(([baslik, icerik]) => (
                    <View key={baslik} style={{ marginBottom: 14 }}>
                      <Text
                        style={{
                          fontWeight: "800",
                          fontSize: 13,
                          color: "#111",
                          marginBottom: 4,
                        }}
                      >
                        {baslik}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: "#444", lineHeight: 18 }}
                      >
                        {icerik}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.authMainBtn, { marginTop: 16 }]}
                  onPress={() => {
                    setSozlesmeKabul(true);
                    setSozlesmeModalGorunur(false);
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    Okudum, Kabul Ediyorum
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSozlesmeModalGorunur(false)}
                  style={{ marginTop: 12, alignItems: "center" }}
                >
                  <Text style={{ color: "#888" }}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* KLASÖR OLUŞTUR / DÜZENLE MODAL */}
          <Modal visible={klasorModalGorunur} animationType="fade" transparent>
            <View style={styles.blurOverlay}>
              <View style={[styles.authCard, { backgroundColor: t.card }]}>
                <Text style={[styles.authTitle, { color: t.text }]}>
                  {klasorDuzenlenen
                    ? "Klasörü Yeniden Adlandır"
                    : "Yeni Klasör"}
                </Text>
                <TextInput
                  style={[
                    styles.authInput,
                    { backgroundColor: t.input, color: t.inputText },
                  ]}
                  placeholder="Klasör adı..."
                  placeholderTextColor={t.placeholder}
                  value={klasorAdi}
                  onChangeText={setKlasorAdi}
                  autoFocus
                  maxLength={30}
                />
                <TouchableOpacity
                  style={styles.authMainBtn}
                  onPress={
                    klasorDuzenlenen ? klasorYendenAdlandir : klasorOlustur
                  }
                >
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    {klasorDuzenlenen ? "Kaydet" : "Oluştur"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setKlasorModalGorunur(false);
                    setKlasorAdi("");
                    setKlasorDuzenlenen(null);
                  }}
                  style={{ marginTop: 12, alignItems: "center" }}
                >
                  <Text style={{ color: "#888" }}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* QR KLASÖRE TAŞI MODAL */}
          <Modal
            visible={qrKlasorModalGorunur}
            animationType="fade"
            transparent
          >
            <View style={styles.blurOverlay}>
              <View style={styles.authCard}>
                <Text style={styles.authTitle}>Klasöre Taşı</Text>
                <Text style={{ color: "#888", fontSize: 13, marginBottom: 14 }}>
                  {klasorAtanacakQr?.title}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.klasorSecimSatir,
                    klasorAtanacakQr?.folder_id === null &&
                      styles.klasorSecimSatirActive,
                  ]}
                  onPress={() => qrKlasoraDegistir(klasorAtanacakQr?.id, null)}
                >
                  <Text style={styles.klasorSecimSatirText}>
                    📂 Genel (Klasörsüz)
                  </Text>
                </TouchableOpacity>
                {klasorler.map((k) => (
                  <TouchableOpacity
                    key={k.id}
                    style={[
                      styles.klasorSecimSatir,
                      klasorAtanacakQr?.folder_id === k.id &&
                        styles.klasorSecimSatirActive,
                    ]}
                    onPress={() =>
                      qrKlasoraDegistir(klasorAtanacakQr?.id, k.id)
                    }
                  >
                    <Text style={styles.klasorSecimSatirText}>📁 {k.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    setQrKlasorModalGorunur(false);
                    setKlasorAtanacakQr(null);
                  }}
                  style={{ marginTop: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#888" }}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ISIM MODAL */}
          <Modal
            visible={isimModalGorunur}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={[styles.authCard, { backgroundColor: t.card }]}>
                <Text style={[styles.authTitle, { color: t.text }]}>
                  QR Koda Isim Ver
                </Text>
                <TextInput
                  style={[
                    styles.authInput,
                    { backgroundColor: t.input, color: t.inputText },
                  ]}
                  placeholder="Orn: Instagram QR..."
                  placeholderTextColor={t.placeholder}
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
                    KAYDET
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsimModalGorunur(false)}
                  style={{ marginTop: 15 }}
                >
                  <Text style={{ color: t.textSub }}>Vazgec</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* INDIR MODAL */}
          <Modal
            visible={indirModalGorunur}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={[styles.authCard, { backgroundColor: t.card }]}>
                <Text style={[styles.authTitle, { color: t.text }]}>Indir</Text>
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: darkMod ? "#3A3A3C" : "#1C1C1E" }]}
                  onPress={async () => {
                    setIndirModalGorunur(false);
                    await galeriyeKaydet();
                  }}
                >
                  <Text style={styles.downloadBtnText}>PNG olarak indir</Text>
                </TouchableOpacity>
                {isLocked ? (
                  <View
                    style={[
                      styles.downloadBtn,
                      { backgroundColor: t.card2, borderWidth: 1.5, borderColor: t.border },
                    ]}
                  >
                    <Text style={{ fontWeight: "800", color: t.text, fontSize: 14 }}>
                      Profesyonel SVG indir
                    </Text>
                    <Text style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
                      Plus plan ile acilir
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: "#007AFF" }]}
                    onPress={async () => {
                      setIndirModalGorunur(false);
                      await svgOlarakIndir();
                    }}
                  >
                    <Text style={styles.downloadBtnText}>SVG olarak indir</Text>
                  </TouchableOpacity>
                )}
                {isLocked ? (
                  <View
                    style={[
                      styles.downloadBtn,
                      { backgroundColor: t.card2, borderWidth: 1.5, borderColor: t.border },
                    ]}
                  >
                    <Text style={{ fontWeight: "800", color: t.text, fontSize: 14 }}>
                      Profesyonel PDF indir
                    </Text>
                    <Text style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
                      Plus plan ile acilir
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: "#FF3B30" }]}
                    onPress={async () => {
                      setIndirModalGorunur(false);
                      await pdfOlarakIndir();
                    }}
                  >
                    <Text style={styles.downloadBtnText}>PDF olarak indir</Text>
                  </TouchableOpacity>
                )}
                {isLocked && (
                  <TouchableOpacity
                    style={{ marginBottom: 6 }}
                    onPress={() => {
                      setIndirModalGorunur(false);
                      setPaketModalGorunur(true);
                    }}
                  >
                    <Text style={{ color: "#007AFF", fontWeight: "700" }}>
                      Plus plana gec →
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setIndirModalGorunur(false)}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: t.textSub }}>Vazgec</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* PAYLAS MODAL */}
          <Modal
            visible={paylasModalGorunur}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.blurOverlay}>
              <View style={[styles.authCard, { backgroundColor: t.card }]}>
                <Text style={[styles.authTitle, { color: t.text }]}>Paylas</Text>
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: darkMod ? "#3A3A3C" : "#1C1C1E" }]}
                  onPress={async () => {
                    setPaylasModalGorunur(false);
                    await pngOlarakPaylas();
                  }}
                >
                  <Text style={styles.downloadBtnText}>PNG olarak paylas</Text>
                </TouchableOpacity>
                {isLocked ? (
                  <View
                    style={[
                      styles.downloadBtn,
                      { backgroundColor: t.card2, borderWidth: 1.5, borderColor: t.border },
                    ]}
                  >
                    <Text style={{ fontWeight: "800", color: t.text, fontSize: 14 }}>
                      Profesyonel SVG paylas
                    </Text>
                    <Text style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
                      Plus plan ile acilir
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: "#007AFF" }]}
                    onPress={async () => {
                      setPaylasModalGorunur(false);
                      await svgOlarakPaylas();
                    }}
                  >
                    <Text style={styles.downloadBtnText}>
                      SVG olarak paylas
                    </Text>
                  </TouchableOpacity>
                )}
                {isLocked ? (
                  <View
                    style={[
                      styles.downloadBtn,
                      { backgroundColor: t.card2, borderWidth: 1.5, borderColor: t.border },
                    ]}
                  >
                    <Text style={{ fontWeight: "800", color: t.text, fontSize: 14 }}>
                      Profesyonel PDF paylas
                    </Text>
                    <Text style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
                      Plus plan ile acilir
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: "#FF3B30" }]}
                    onPress={async () => {
                      setPaylasModalGorunur(false);
                      await pdfOlarakPaylas();
                    }}
                  >
                    <Text style={styles.downloadBtnText}>
                      PDF olarak paylas
                    </Text>
                  </TouchableOpacity>
                )}
                {isLocked && (
                  <TouchableOpacity
                    style={{ marginBottom: 6 }}
                    onPress={() => {
                      setPaylasModalGorunur(false);
                      setPaketModalGorunur(true);
                    }}
                  >
                    <Text style={{ color: "#007AFF", fontWeight: "700" }}>
                      Plus plana gec →
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setPaylasModalGorunur(false)}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: t.textSub }}>Vazgec</Text>
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
                  Planini Sec, Markani Buyut 🚀
                </Text>
                {[
                  {
                    name: "Plus",
                    planId: "plus",
                    price: "$4.99/ay",
                    features: [
                      "• 5 Adet Dinamik QR",
                      "• Ozel Logo Ekleme",
                      "• PDF & SVG Cikti",
                      "• Premium Desenler",
                    ],
                    highlight: false,
                  },
                  {
                    name: "Pro 🔥",
                    planId: "pro",
                    price: "$9.99/ay",
                    features: [
                      "• 25 Adet Dinamik QR",
                      "• Tum Premium Ozellikler",
                      "• Vektorel Cikti",
                    ],
                    highlight: true,
                  },
                  {
                    name: "Agency",
                    planId: "agency",
                    price: "$39.00/ay",
                    features: [
                      "• 200 Adet Dinamik QR",
                      "• Musteri Klasorleme",
                      "• Ekip Paylasimi",
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
                        if (!session) {
                          setPaketModalGorunur(false);
                          setIsSignUp(true);
                          setAuthModalGorunur(true);
                        } else {
                          satinAl(plan.planId);
                        }
                      }}
                    >
                      <Text style={styles.planButtonText}>
                        {session ? "PLANA GEC" : "KAYIT OL VE SEC"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {session && (
                  <TouchableOpacity
                    style={{
                      alignItems: "center",
                      paddingVertical: 12,
                      marginBottom: 8,
                    }}
                    onPress={aboneligiGeriYukle}
                  >
                    <Text
                      style={{
                        color: "#007AFF",
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Aboneligi Geri Yukle
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </View>

        {/* BOTTOM TAB BAR */}
        <View
          style={[
            styles.bottomTabBar,
            { backgroundColor: t.tabBar, borderTopColor: t.border },
          ]}
        >
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setActiveTab(0)}
          >
            <Text
              style={[styles.tabIcon, activeTab === 0 && styles.tabIconActive]}
            >
              📁
            </Text>
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 0 ? "#007AFF" : t.textSub },
              ]}
            >
              Koleksiyonum
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setActiveTab(1)}
          >
            <Text
              style={[styles.tabIcon, activeTab === 1 && styles.tabIconActive]}
            >
              ✦
            </Text>
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 1 ? "#007AFF" : t.textSub },
              ]}
            >
              QR Stüdyosu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setActiveTab(2)}
          >
            <Text
              style={[styles.tabIcon, activeTab === 2 && styles.tabIconActive]}
            >
              {session ? "👤" : "🔑"}
            </Text>
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 2 ? "#007AFF" : t.textSub },
              ]}
            >
              Profil
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  scrollContent: { paddingBottom: 36 },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileEmoji: { fontSize: 22 },
  brandCenter: { flex: 1, alignItems: "center" },
  headerSpacer: { width: 40 },
  brandName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
  },
  tagline: {
    marginTop: 2,
    fontSize: 12,
    color: "#7A7A7A",
    textAlign: "center",
  },
  previewCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 28,
    padding: 18,
    alignItems: "center",
  },
  qrShadowBox: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  qrWatermark: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  qrWatermarkText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  subWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  subWarningIcon: { fontSize: 22 },
  subWarningTitle: { fontWeight: "800", fontSize: 13, marginBottom: 2 },
  subWarningDesc: { fontSize: 12, color: "#666", lineHeight: 16 },
  promoBadge: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F3F7FF",
    borderRadius: 14,
  },
  promoText: {
    color: "#275EFE",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  modernToolbar: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 16,
  },
  mainAction: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: { opacity: 0.6 },
  colorDot: { width: 22, height: 22, borderRadius: 11, marginBottom: 8 },
  actionEmoji: { fontSize: 22, marginBottom: 6 },
  actionText: { fontWeight: "700", color: "#111" },
  designSection: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A8A8E",
    marginBottom: 10,
  },
  sectionLabelTopSpacing: { marginTop: 18 },
  sectionLabelSmall: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8A8A8E",
    marginBottom: 8,
  },
  selectorRow: { paddingRight: 4 },
  selectorCard: {
    width: 88,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFF",
    alignItems: "center",
    position: "relative",
  },
  selectorCardActive: { borderColor: "#007AFF", backgroundColor: "#F1F7FF" },
  selectorLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
  },
  selectorLabelActive: { color: "#007AFF" },
  lockMini: { position: "absolute", top: 6, right: 6, fontSize: 11 },
  gradientToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  styleBtn: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  styleBtnText: { color: "#111", fontWeight: "700" },
  activeBtn: { borderColor: "#007AFF", backgroundColor: "#EAF3FF" },
  flexOne: { flex: 1 },
  gradientEditBtn: { borderColor: "#007AFF", backgroundColor: "#E8F2FF" },
  gradientEditInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniColorDot: { width: 16, height: 16, borderRadius: 8 },
  arrowText: { fontSize: 12, fontWeight: "700" },
  gradientEditText: { fontSize: 11, color: "#007AFF", fontWeight: "700" },
  gradientDirectionWrap: { marginBottom: 12 },
  gradientDirectionsRow: { flexDirection: "row", gap: 8 },
  directionBtn: { paddingVertical: 10 },
  directionEmoji: { fontSize: 18 },
  directionLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  cornerBtn: {
    marginBottom: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 18,
  },
  paletteCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: "#FFF",
  },
  innerCircle: { width: 20, height: 20, borderRadius: 10 },
  resetBtn: { paddingHorizontal: 14, justifyContent: "center" },
  resetText: { fontSize: 12, color: "#888" },
  inputArea: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 16,
  },
  inputWrapper: {
    backgroundColor: "#F5F5F7",
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  textInput: { height: 50, color: "#111" },
  dynamicButton: {
    borderRadius: 16,
    backgroundColor: "#F2F4F7",
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  darkButton: { backgroundColor: "#000" },
  dynamicButtonText: { fontWeight: "800", color: "#111" },
  lightText: { color: "#FFF" },
  rowButtons: { flexDirection: "row", gap: 12 },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: { fontWeight: "700", color: "#111" },
  dashboardContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 16,
  },
  dashboardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dashboardTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  refreshText: { color: "#007AFF" },
  emptyState: {
    backgroundColor: "#F7F8FA",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  emptyStateText: { color: "#888" },
  qrItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  qrItemLeft: { flex: 1 },
  qrItemTitle: { fontWeight: "bold", fontSize: 15, textAlign: "left" },
  scanBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#EEF6FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scanText: { fontSize: 12, fontWeight: "700", color: "#007AFF" },
  editBtn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnSm: {
    backgroundColor: "#007AFF",
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
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
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  },
  closeSheet: {
    backgroundColor: "#000",
    height: 58,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  closeSheetText: { color: "#FFF", fontWeight: "bold" },
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
  analizKart: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  analizSayi: { fontSize: 32, fontWeight: "900", color: "#111" },
  analizLabel: { fontSize: 12, color: "#888", marginTop: 4, fontWeight: "600" },
  analizSection: {
    backgroundColor: "#F7F8FA",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  analizSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  analizRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  analizRowLabel: { fontSize: 13, color: "#333", width: 90, fontWeight: "600" },
  analizRowVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111",
    width: 36,
    textAlign: "right",
  },
  analizAxisLabel: { fontSize: 10, color: "#AAA", fontWeight: "600" },
  analizLock: {
    backgroundColor: "#F7F8FA",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
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
  tabContent: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 3,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8A8A8E",
  },
  tabLabelActive: {
    color: "#007AFF",
  },
  collapseToggle: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: "#FFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  collapseToggleText: {
    fontWeight: "800",
    color: "#111",
    fontSize: 14,
  },
  bigRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E8",
  },
  bigRefreshText: {
    fontSize: 18,
    color: "#555",
    fontWeight: "600",
    lineHeight: 20,
  },
  miniQrThumbnail: {
    width: 62,
    height: 62,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  klasorChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F0F0F5",
    borderWidth: 1,
    borderColor: "#E0E0EA",
  },
  klasorChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  klasorChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
  },
  klasorChipTextActive: {
    color: "#FFF",
  },
  klasorChipAdd: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#007AFF",
  },
  klasorChipAddText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#007AFF",
  },
  klasorSecimSatir: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F7F8FA",
    marginBottom: 8,
  },
  klasorSecimSatirActive: {
    backgroundColor: "#EAF3FF",
    borderWidth: 1.5,
    borderColor: "#007AFF",
  },
  klasorSecimSatirText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
});
