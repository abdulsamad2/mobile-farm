import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { SlotState } from './farmService';

interface Props {
  slot: SlotState;
  onComplete: (slotId: number, cookies: any[], success: boolean) => void;
}

const EXTRACT_JS = `
(function(){
  var cs = document.cookie.split(';').map(function(c){
    var p = c.trim().split('=');
    return { name: p[0], value: p.slice(1).join('='), domain: location.hostname, path: '/' };
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type:'cookies', cookies:cs,
    hasTmpt: cs.some(function(c){ return c.name==='tmpt'; }),
    url: location.href, title: document.title
  }));
  true;
})();
`;

export default function SlotView({ slot, onComplete }: Props) {
  const webRef = useRef<WebView>(null);
  const t0 = useRef<number>(0);

  useEffect(() => {
    if (slot.status === 'minting') t0.current = Date.now();
  }, [slot.status, slot.currentUrl]);

  const onNav = (e: any) => {
    if (/paused|verified|interruption|activity|blocked|robot/i.test(e.title || '')) {
      onComplete(slot.id, [], false);
      return;
    }
    if ((e.url || '').includes('/event/')) {
      setTimeout(() => webRef.current?.injectJavaScript(EXTRACT_JS), 6000);
    }
  };

  const onMsg = (e: any) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'cookies') {
        if (d.hasTmpt && d.cookies.length) {
          console.log(`[slot ${slot.id}] ✓ ${d.cookies.length} cookies in ${Math.round((Date.now()-t0.current)/1000)}s`);
          onComplete(slot.id, d.cookies, true);
        } else {
          onComplete(slot.id, [], false);
        }
      }
    } catch {}
  };

  const fmtExpiry = (ts: number | null) => {
    if (!ts) return '—';
    const m = Math.round((ts - Date.now()) / 60000);
    return m > 0 ? `${m}m` : 'expired';
  };

  const color = { idle:'#666', minting:'#f39c12', healthy:'#2ecc71', failed:'#e74c3c' }[slot.status];

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.name}>Slot {slot.id}</Text>
        <View style={[s.badge, { backgroundColor: color }]}>
          <Text style={s.badgeTxt}>{slot.status}</Text>
        </View>
      </View>
      <Text style={s.info}>
        Cookies: {slot.cookieCount}  ·  Expires: {fmtExpiry(slot.expiresAt)}
      </Text>
      {slot.error ? <Text style={s.err}>{slot.error}</Text> : null}

      {slot.status === 'minting' && slot.currentUrl ? (
        <WebView
          ref={webRef}
          source={{ uri: slot.currentUrl }}
          style={s.wv}
          onNavigationStateChange={onNav}
          onMessage={onMsg}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          cacheEnabled={false}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor:'#2a2a2a', borderRadius:8, marginBottom:12, overflow:'hidden' },
  row: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:12 },
  name: { color:'#fff', fontSize:16, fontWeight:'bold' },
  badge: { paddingHorizontal:8, paddingVertical:3, borderRadius:4 },
  badgeTxt: { color:'#fff', fontSize:11, fontWeight:'bold', textTransform:'uppercase' },
  info: { color:'#aaa', fontSize:12, paddingHorizontal:12, paddingBottom:8 },
  err: { color:'#e74c3c', fontSize:12, paddingHorizontal:12, paddingBottom:8 },
  wv: { height:1, opacity:0 },          // hidden — we only need cookies, not visual
});
