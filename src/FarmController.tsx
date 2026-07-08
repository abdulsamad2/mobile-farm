import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SlotView from './SlotView';
import { uploadJar, pickEvent, type SlotState } from './farmService';

const LOOP_MS = 20_000;
const REFRESH_MARGIN = 5 * 60_000;

export default function FarmController() {
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [running, setRunning] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [slotCount, setSlotCount] = useState(2);
  const [ttlMin, setTtlMin] = useState(50);
  const [eventUrl, setEventUrl] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- boot ----
  useEffect(() => {
    (async () => {
      const p = await AsyncStorage.getItem('portalUrl');
      const k = await AsyncStorage.getItem('apiKey');
      const c = await AsyncStorage.getItem('slotCount');
      const t = await AsyncStorage.getItem('ttlMin');
      if (p) setPortalUrl(p);
      if (k) setApiKey(k);
      if (c) setSlotCount(parseInt(c, 10) || 2);
      if (t) setTtlMin(parseInt(t, 10) || 50);
      initSlots(c ? parseInt(c, 10) : 2);
    })();
  }, []);

  const initSlots = (n: number) =>
    setSlots(Array.from({ length: n }, (_, i) => ({
      id: i, status: 'idle', cookieCount: 0, expiresAt: null,
      lastMint: null, error: null, currentUrl: '',
    })));

  // ---- farm loop ----
  useEffect(() => {
    if (running && portalUrl && apiKey) {
      round();
      timer.current = setInterval(round, LOOP_MS);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const round = useCallback(async () => {
    let url = eventUrl;
    if (!url) {
      try { url = await pickEvent(portalUrl, apiKey); }
      catch { return; }
    }
    if (!url) return;

    setSlots(prev => prev.map(sl => {
      if (sl.status === 'healthy' && sl.expiresAt && sl.expiresAt - Date.now() > REFRESH_MARGIN) return sl;
      if (sl.status === 'minting') return sl; // already in flight
      return { ...sl, status: 'minting' as const, currentUrl: url, error: null };
    }));
  }, [portalUrl, apiKey, eventUrl]);

  // ---- slot callbacks ----
  const onSlotDone = useCallback(async (id: number, cookies: any[], ok: boolean) => {
    if (!ok) {
      setSlots(p => p.map(s => s.id === id ? { ...s, status: 'failed', error: 'Mint failed', currentUrl: '' } : s));
      return;
    }
    const devId = (await AsyncStorage.getItem('deviceId')) || 'mobile';
    const jarId = `${devId}::slot-${id}`;
    const ttlMs = ttlMin * 60_000;
    try {
      await uploadJar(portalUrl, apiKey, jarId, cookies, ttlMs, { machineId: devId, slot: id });
      setSlots(p => p.map(s => s.id === id ? {
        ...s, status: 'healthy', cookieCount: cookies.length,
        expiresAt: Date.now() + ttlMs, lastMint: Date.now(), error: null, currentUrl: '',
      } : s));
    } catch {
      setSlots(p => p.map(s => s.id === id ? { ...s, status: 'failed', error: 'Upload failed', currentUrl: '' } : s));
    }
  }, [portalUrl, apiKey, ttlMin]);

  // ---- config ----
  const save = async () => {
    await AsyncStorage.multiSet([
      ['portalUrl', portalUrl], ['apiKey', apiKey],
      ['slotCount', String(slotCount)], ['ttlMin', String(ttlMin)],
    ]);
    initSlots(slotCount);
    Alert.alert('Saved');
  };

  const toggle = () => {
    if (!portalUrl || !apiKey) { Alert.alert('Error', 'Set Portal URL and API Key first'); return; }
    setRunning(r => !r);
  };

  // ---- UI ----
  return (
    <View style={st.root}>
      <View style={st.hdr}>
        <Text style={st.title}>Mobile Farm</Text>
        <Text style={st.sub}>{running ? '🟢 Running' : '⚪ Stopped'}</Text>
      </View>

      <ScrollView style={st.cfg} keyboardShouldPersistTaps="handled">
        <Label t="Portal URL" />
        <Input v={portalUrl} set={setPortalUrl} ph="https://tixforyou.com" />
        <Label t="API Key" />
        <Input v={apiKey} set={setApiKey} ph="ext_..." secure />
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Label t="Slots" />
            <Input v={String(slotCount)} set={v => setSlotCount(parseInt(v,10)||1)} ph="2" num />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Label t="TTL (min)" />
            <Input v={String(ttlMin)} set={v => setTtlMin(parseInt(v,10)||50)} ph="50" num />
          </View>
        </View>
        <Label t="Event URL (optional)" />
        <Input v={eventUrl} set={setEventUrl} ph="Leave empty for rotation" />
        <View style={st.btns}>
          <Btn label="Save" bg="#444" onPress={save} />
          <Btn label={running ? 'Stop' : 'Start'} bg={running ? '#e74c3c' : '#2ecc71'} onPress={toggle} />
        </View>
      </ScrollView>

      <ScrollView style={st.slots}>
        <Text style={st.sec}>Slots</Text>
        {slots.map(sl => <SlotView key={sl.id} slot={sl} onComplete={onSlotDone} />)}
      </ScrollView>
    </View>
  );
}

// ---- tiny helpers so the main component stays readable ----
const Label = ({ t }: { t: string }) => <Text style={{ color:'#aaa', fontSize:12, marginTop:8, marginBottom:2 }}>{t}</Text>;

const Input = ({ v, set, ph, secure, num }: {
  v: string; set: (s: string) => void; ph?: string; secure?: boolean; num?: boolean;
}) => (
  <TextInput
    style={{ backgroundColor:'#2a2a2a', color:'#fff', padding:12, borderRadius:6, borderWidth:1, borderColor:'#444' }}
    value={v} onChangeText={set} placeholder={ph} placeholderTextColor="#666"
    autoCapitalize="none" secureTextEntry={secure} keyboardType={num ? 'number-pad' : 'default'}
  />
);

const Btn = ({ label, bg, onPress }: { label: string; bg: string; onPress: () => void }) => (
  <TouchableOpacity style={{ flex:1, backgroundColor:bg, padding:14, borderRadius:6, alignItems:'center' }} onPress={onPress}>
    <Text style={{ color:'#fff', fontWeight:'bold' }}>{label}</Text>
  </TouchableOpacity>
);

const st = StyleSheet.create({
  root: { flex:1, backgroundColor:'#1a1a1a' },
  hdr: { padding:16, borderBottomWidth:1, borderBottomColor:'#333' },
  title: { fontSize:24, fontWeight:'bold', color:'#fff' },
  sub: { fontSize:14, color:'#aaa', marginTop:4 },
  cfg: { padding:16, maxHeight:360 },
  row: { flexDirection:'row' },
  btns: { flexDirection:'row', gap:12, marginTop:16, marginBottom:8 },
  slots: { flex:1, padding:16 },
  sec: { fontSize:18, fontWeight:'bold', color:'#fff', marginBottom:12 },
});
