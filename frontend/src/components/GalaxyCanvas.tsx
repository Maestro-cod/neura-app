import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
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
html,body{width:100%;height:100%;overflow:hidden;background:#02020a;}
canvas{display:block;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
/* ── Zone data injected from React Native ── */
const ZONES=${zonesJson};

/* ── Canvas setup ── */
const c=document.getElementById('c');
const ctx=c.getContext('2d');
let W,H,CX,CY;
function resize(){
  W=c.width=window.innerWidth;
  H=c.height=window.innerHeight;
  CX=W/2; CY=H/2;
}
resize();
window.addEventListener('resize',resize);

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
  if(n===0){requestAnimationFrame(draw);return;}

  /* Planet orbital parameters */
  const OX=Math.min(W,H)*0.33;   /* semi-major axis (horizontal) */
  const OY=OX*0.52;               /* semi-minor axis – creates depth illusion */
  const ROT=t*0.000048;           /* very slow orbit */

  const planets=ZONES.map((z,i)=>{
    const base=(i/n)*Math.PI*2-Math.PI/2;
    const ang=base+ROT;
    const x=CX+Math.cos(ang)*OX;
    const y=CY+Math.sin(ang)*OY;
    const z3d=(Math.sin(ang)+1)*0.5;   /* 0=back, 1=front */
    const size=Math.min(W,H)*(0.021+z3d*0.017);
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

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
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

  return (
    // pointerEvents="none" lets all touches fall through to the RN overlays
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
        // Prevent the WebView itself from stealing touches on Android
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
