import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Zone {
  id: string;
  name: string;
  color: string;
}

interface GalaxyCanvasProps {
  zones?: Zone[];
}

// ─── Fallback zone colours (shown before user data loads) ─────────────────────
const DEFAULT_ZONES: Array<{ name: string; color: string }> = [
  { name: "Health",  color: "#00f5a0" },
  { name: "Home",    color: "#7c6fff" },
  { name: "Finance", color: "#f5a623" },
  { name: "Work",    color: "#00d4ff" },
  { name: "Family",  color: "#ff6b9d" },
  { name: "Self",    color: "#c3f53c" },
];

// ─── HTML generator ──────────────────────────────────────────────────────────
function buildGalaxyHTML(zones: Array<{ name: string; color: string }>): string {
  const zonesJson = JSON.stringify(zones);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:#02020a;touch-action:none;}
canvas{display:block;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<canvas id="bloom" style="display:none;"></canvas>
<script>
/* ── Zone data injected from React Native ── */
const ZONES=${zonesJson};

/* ── Canvas setup ── */
const c=document.getElementById('c');
const ctx=c.getContext('2d');
const bloomCanvas=document.getElementById('bloom');
const bloomCtx=bloomCanvas.getContext('2d');
let W,H,CX,CY;
function resize(){
  W=c.width=bloomCanvas.width=window.innerWidth;
  H=c.height=bloomCanvas.height=window.innerHeight;
  CX=W/2; CY=H/2;
}
resize();
window.addEventListener('resize',resize);

/* ══════════════════════════════════════════════════════════════════════════════
   FEATURE 1: Pinch-to-zoom & drag-to-rotate gestures
   ══════════════════════════════════════════════════════════════════════════════ */
let gestureScale = 1.0;
let gestureRotation = 0;        /* additional rotation offset in radians */
let _pinchStartDist = 0;
let _pinchStartScale = 1;
let _dragStartX = 0;
let _dragStartRot = 0;
let _activeTouches = 0;
/* Mouse wheel zoom (desktop) */
let _mouseDown = false;
let _mouseStartX = 0;
let _mouseStartRot = 0;

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

c.addEventListener('touchstart', function(e) {
  e.preventDefault();
  _activeTouches = e.touches.length;
  if (e.touches.length === 2) {
    _pinchStartDist = touchDist(e.touches);
    _pinchStartScale = gestureScale;
  } else if (e.touches.length === 1) {
    _dragStartX = e.touches[0].clientX;
    _dragStartRot = gestureRotation;
  }
}, { passive: false });

c.addEventListener('touchmove', function(e) {
  e.preventDefault();
  if (e.touches.length === 2) {
    /* Pinch to zoom */
    const dist = touchDist(e.touches);
    const ratio = dist / _pinchStartDist;
    gestureScale = Math.max(0.3, Math.min(4.0, _pinchStartScale * ratio));
  } else if (e.touches.length === 1 && _activeTouches === 1) {
    /* Drag to rotate */
    const dx = e.touches[0].clientX - _dragStartX;
    gestureRotation = _dragStartRot + dx * 0.008;
  }
}, { passive: false });

c.addEventListener('touchend', function(e) {
  _activeTouches = e.touches.length;
}, { passive: false });

/* Desktop: scroll-wheel zoom + click-drag rotate */
c.addEventListener('wheel', function(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.92 : 1.08;
  gestureScale = Math.max(0.3, Math.min(4.0, gestureScale * delta));
}, { passive: false });

c.addEventListener('mousedown', function(e) {
  _mouseDown = true;
  _mouseStartX = e.clientX;
  _mouseStartRot = gestureRotation;
});
window.addEventListener('mousemove', function(e) {
  if (!_mouseDown) return;
  const dx = e.clientX - _mouseStartX;
  gestureRotation = _mouseStartRot + dx * 0.008;
});
window.addEventListener('mouseup', function() { _mouseDown = false; });

/* ══════════════════════════════════════════════════════════════════════════════
   FEATURE 3: Pause animation when tab loses focus (save battery)
   ══════════════════════════════════════════════════════════════════════════════ */
let animRunning = true;
let rafId = 0;
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    animRunning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  } else {
    if (!animRunning) {
      animRunning = true;
      rafId = requestAnimationFrame(draw);
    }
  }
});
/* Also listen for window blur/focus (WebView may fire these instead) */
window.addEventListener('blur', function() {
  animRunning = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
});
window.addEventListener('focus', function() {
  if (!animRunning) {
    animRunning = true;
    rafId = requestAnimationFrame(draw);
  }
});

/* ── Colour helpers ── */
function hexRgb(h){
  return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
}
function rgba(h,a){
  const[r,g,b]=hexRgb(h);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

/* ── Star particles ── */
const SCOLS=[[255,255,255],[160,232,255],[154,255,216],[208,192,255],[255,220,200]];
const stars=Array.from({length:230},()=>{
  const col=SCOLS[Math.floor(Math.random()*SCOLS.length)];
  return{
    x:Math.random(), y:Math.random(),
    r:Math.random()*1.1+0.25,
    spd:Math.random()*0.000055+0.000018,
    ph:Math.random()*Math.PI*2,
    ps:Math.random()*0.022+0.008,
    a:Math.random()*0.45+0.14,
    cr:col[0],cg:col[1],cb:col[2],
  };
});

/* ── Static nebula blobs ── */
const NEBULAS=[
  ['#00f5a0',0.22,0.28,0.38,0.07],
  ['#00d4ff',0.76,0.62,0.31,0.07],
  ['#7c6fff',0.52,0.18,0.26,0.05],
  ['#ff6b9d',0.12,0.72,0.30,0.05],
  ['#f5a623',0.68,0.22,0.22,0.04],
];

/* ══════════════════════════════════════════════════════════════════════════════
   FEATURE 2: Bloom post-processing
   Uses an offscreen canvas to capture emissive elements (planets + lines),
   applies Gaussian blur, then composites with additive blending (screen).
   ══════════════════════════════════════════════════════════════════════════════ */
function applyBloom() {
  /* Copy emissive elements from main canvas to bloom canvas */
  bloomCtx.clearRect(0, 0, W, H);
  bloomCtx.drawImage(c, 0, 0);

  /* Multi-pass blur for smooth bloom */
  bloomCtx.filter = 'blur(12px) brightness(1.6)';
  bloomCtx.globalCompositeOperation = 'source-over';
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.filter = 'blur(6px) brightness(1.2)';
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.filter = 'none';

  /* Composite bloom back onto main canvas with "screen" blending */
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.45;
  ctx.drawImage(bloomCanvas, 0, 0);
  ctx.restore();
}

/* ── Animation loop ── */
function draw(t){
  /* Background radial gradient */
  const bg=ctx.createRadialGradient(CX,CY*0.72,0,CX,CY,Math.max(W,H)*0.85);
  bg.addColorStop(0,'#0d0425');
  bg.addColorStop(0.45,'#07051a');
  bg.addColorStop(1,'#02020a');
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,W,H);

  /* Nebula blobs */
  for(const[color,fx,fy,fr,fa] of NEBULAS){
    const g=ctx.createRadialGradient(fx*W,fy*H,0,fx*W,fy*H,fr*W);
    g.addColorStop(0,rgba(color,fa));
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,W,H);
  }

  /* Twinkling stars */
  for(const s of stars){
    s.ph+=s.ps;
    s.y+=s.spd;
    if(s.y>1)s.y=0;
    const alpha=s.a*(0.5+0.5*Math.sin(s.ph));
    ctx.beginPath();
    ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba('+s.cr+','+s.cg+','+s.cb+','+alpha+')';
    ctx.fill();
  }

  const n=ZONES.length;
  if(n===0){rafId=requestAnimationFrame(draw);return;}

  /* Planet orbital parameters — GESTURE-AWARE */
  const baseOrbit = Math.min(W,H)*0.33;
  const OX = baseOrbit * gestureScale;   /* scaled by pinch gesture */
  const OY = OX * 0.52;
  const ROT = t * 0.000048 + gestureRotation;  /* offset by drag gesture */

  const planets=ZONES.map((z,i)=>{
    const base=(i/n)*Math.PI*2-Math.PI/2;
    const ang=base+ROT;
    const x=CX+Math.cos(ang)*OX;
    const y=CY+Math.sin(ang)*OY;
    const z3d=(Math.sin(ang)+1)*0.5;   /* 0=back, 1=front */
    const size=Math.min(W,H)*(0.021+z3d*0.017)*gestureScale;
    return{x,y,z3d,size,color:z.color,ang};
  });

  /* Orbit ellipse track */
  ctx.beginPath();
  ctx.ellipse(CX,CY,OX,OY,0,0,Math.PI*2);
  ctx.strokeStyle='rgba(110,110,200,0.07)';
  ctx.lineWidth=0.9;
  ctx.stroke();

  /* Neural connecting lines (all pairs) */
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      const a=planets[i],b=planets[j];
      const avgZ=(a.z3d+b.z3d)*0.5;
      const alpha=0.035+avgZ*0.09;
      const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
      g.addColorStop(0,rgba(a.color,alpha));
      g.addColorStop(1,rgba(b.color,alpha));
      ctx.beginPath();
      ctx.moveTo(a.x,a.y);
      ctx.lineTo(b.x,b.y);
      ctx.strokeStyle=g;
      ctx.lineWidth=0.4+avgZ*0.9;
      ctx.stroke();
    }
  }

  /* Draw planets back-to-front for correct depth layering */
  const sorted=[...planets].sort((a,b)=>a.z3d-b.z3d);
  for(const p of sorted){
    const pulse=1+Math.sin(t*0.003+p.ang*4)*0.07;
    const r=p.size*pulse;
    const gR=r*4.6;

    /* Outer glow halo */
    const glow=ctx.createRadialGradient(p.x,p.y,r*0.3,p.x,p.y,gR);
    glow.addColorStop(0,rgba(p.color,0.16+p.z3d*0.20));
    glow.addColorStop(0.35,rgba(p.color,0.055));
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(p.x,p.y,gR,0,Math.PI*2);
    ctx.fillStyle=glow;
    ctx.fill();

    /* Glossy planet core */
    const core=ctx.createRadialGradient(
      p.x-r*0.32, p.y-r*0.38, r*0.04,
      p.x, p.y, r
    );
    core.addColorStop(0,'rgba(255,255,255,0.92)');
    core.addColorStop(0.22,rgba(p.color,1));
    core.addColorStop(0.75,rgba(p.color,0.88));
    core.addColorStop(1,rgba(p.color,0.32));
    ctx.beginPath();
    ctx.arc(p.x,p.y,r,0,Math.PI*2);
    ctx.fillStyle=core;
    ctx.fill();

    /* Outer ring */
    ctx.beginPath();
    ctx.arc(p.x,p.y,r+1.6,0,Math.PI*2);
    ctx.strokeStyle=rgba(p.color,0.20);
    ctx.lineWidth=1;
    ctx.stroke();
  }

  /* ── Apply bloom post-processing (Feature 2) ── */
  applyBloom();

  rafId=requestAnimationFrame(draw);
}

rafId=requestAnimationFrame(draw);
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function GalaxyCanvas({ zones = [] }: GalaxyCanvasProps) {
  // Only rebuild HTML when the zone list actually changes (ids change)
  const key = useMemo(() => zones.map((z) => z.id).join(",") || "default", [zones]);

  const html = useMemo(() => {
    const effectiveZones =
      zones.length > 0
        ? zones.map((z) => ({ name: z.name, color: z.color || "#888888" }))
        : DEFAULT_ZONES;
    return buildGalaxyHTML(effectiveZones);
  }, [zones]);

  // Web platform: render via iframe since WebView is native-only
  if (Platform.OS === "web") {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <iframe
          key={key}
          srcDoc={html}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: "#02020a",
          }}
          title="Galaxy Canvas"
        />
      </View>
    );
  }

  return (
    // pointerEvents="box-none" lets the View pass touches through
    // but allows the WebView child to receive gesture events (pinch/drag)
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <WebView
        key={key}
        source={{ html }}
        style={styles.webview}
        originWhitelist={["*"]}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
        backgroundColor="#02020a"
        // Allow hardware acceleration for smooth gestures
        androidHardwareAccelerationDisabled={false}
        renderLoading={() => null}
        startInLoadingState={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "#02020a",
  },
});
