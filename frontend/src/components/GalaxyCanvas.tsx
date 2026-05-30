/**
 * GalaxyCanvas — Full-screen interactive 3D galaxy visualization.
 *
 * Renders zone "planets" orbiting a central point with task "moons",
 * twinkling stars, neural connection lines, and full gesture support.
 *
 * Built entirely with react-native-svg + Animated + PanResponder.
 * No WebView, Three.js, or WebGL.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors, fonts, zoneColors, zoneEmojis } from "@/src/theme";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GalaxyZone {
  id: string;
  name: string;
  color: string;
}

export interface GalaxyCanvasProps {
  zones?: GalaxyZone[];
  taskCounts?: Record<string, number>;
  onPlanetTap?: (zone: GalaxyZone) => void;
  onPlanetDoubleTap?: (zone: GalaxyZone) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BG = "#050508";
const STAR_COUNT = 220;
const ANIM_INTERVAL = 50; // ms between animation frames

// Default zones shown before user data loads
const DEFAULT_ZONES: GalaxyZone[] = [
  { id: "d-work",    name: "Work",    color: "#00D4FF" },
  { id: "d-home",    name: "Home",    color: "#FF9500" },
  { id: "d-health",  name: "Health",  color: "#00FF88" },
  { id: "d-finance", name: "Finance", color: "#FFD700" },
  { id: "d-family",  name: "Family",  color: "#FF6B6B" },
  { id: "d-self",    name: "Self",    color: "#8B5CF6" },
];

// ─── Star data (generated once) ──────────────────────────────────────────────
interface Star {
  x: number; // 0..1
  y: number; // 0..1
  r: number;
  phase: number;
  speed: number; // twinkle speed
  baseAlpha: number;
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.3 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.06 + 0.02,
    baseAlpha: Math.random() * 0.5 + 0.15,
  }));
}

const STARS = generateStars(STAR_COUNT);

// ─── Hex → rgb components ────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function GalaxyCanvas({
  zones = [],
  taskCounts = {},
  onPlanetTap,
  onPlanetDoubleTap,
}: GalaxyCanvasProps) {
  // Screen dimensions
  const [dims, setDims] = useState(() => Dimensions.get("window"));
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) =>
      setDims(window)
    );
    return () => sub.remove();
  }, []);

  const W = dims.width;
  const H = dims.height;
  const CX = W / 2;
  const CY = H / 2;

  const effectiveZones = zones.length > 0 ? zones : DEFAULT_ZONES;

  // ── Gesture state (mutable refs for perf) ──────────────────────────────────
  const scaleRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const rotationRef = useRef(0); // radians offset from auto-rotation

  // Pinch tracking
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);

  // Pan tracking
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartPanX = useRef(0);
  const panStartPanY = useRef(0);

  // Double-tap tracking
  const lastTapTime = useRef(0);
  const lastTapX = useRef(0);
  const lastTapY = useRef(0);

  // Animation tick
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (Platform.OS === "web") {
      // Use requestAnimationFrame on web — setInterval can be throttled
      // by browsers when the tab is backgrounded or during rapid re-renders.
      let rafId: number;
      let lastTime = 0;
      const step = (time: number) => {
        if (!mountedRef.current) return;
        if (time - lastTime >= ANIM_INTERVAL) {
          tickRef.current += 1;
          setTick(tickRef.current);
          lastTime = time;
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
      return () => {
        mountedRef.current = false;
        cancelAnimationFrame(rafId);
      };
    }

    // Native: setInterval is fine
    const interval = setInterval(() => {
      if (mountedRef.current) {
        tickRef.current += 1;
        setTick(tickRef.current);
      }
    }, ANIM_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  // ── PanResponder ───────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches ?? [];
          if (touches.length === 2) {
            // Start pinch
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
            pinchStartScale.current = scaleRef.current;
          } else {
            // Start pan
            panStartX.current = evt.nativeEvent.pageX;
            panStartY.current = evt.nativeEvent.pageY;
            panStartPanX.current = panXRef.current;
            panStartPanY.current = panYRef.current;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches ?? [];
          if (touches.length === 2) {
            // Pinch zoom
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (pinchStartDist.current > 0) {
              const ratio = dist / pinchStartDist.current;
              scaleRef.current = Math.max(
                0.4,
                Math.min(3.0, pinchStartScale.current * ratio)
              );
            }
          } else {
            // Drag pan
            panXRef.current = panStartPanX.current + gestureState.dx;
            panYRef.current = panStartPanY.current + gestureState.dy;
          }
        },
        onPanResponderRelease: (evt) => {
          // Detect taps (no significant movement)
          const now = Date.now();
          const x = evt.nativeEvent.pageX;
          const y = evt.nativeEvent.pageY;
          const moved =
            Math.abs(x - panStartX.current) + Math.abs(y - panStartY.current);
          if (moved < 10) {
            // Check double tap
            const timeSinceLast = now - lastTapTime.current;
            const distFromLast =
              Math.abs(x - lastTapX.current) +
              Math.abs(y - lastTapY.current);
            if (timeSinceLast < 350 && distFromLast < 30) {
              // Double tap — find nearest planet
              handleDoubleTap(x, y);
              lastTapTime.current = 0;
            } else {
              // Single tap
              lastTapTime.current = now;
              lastTapX.current = x;
              lastTapY.current = y;
              setTimeout(() => {
                if (lastTapTime.current === now) {
                  handleSingleTap(x, y);
                }
              }, 360);
            }
          }
        },
      }),
    [effectiveZones, taskCounts, onPlanetTap, onPlanetDoubleTap]
  );

  // ── Planet position computation ────────────────────────────────────────────
  const computePlanets = useCallback(
    (t: number) => {
      const n = effectiveZones.length;
      if (n === 0) return [];

      const scale = scaleRef.current;
      const px = panXRef.current;
      const py = panYRef.current;
      const baseOrbit = Math.min(W, H) * 0.28;
      const orbitRx = baseOrbit * scale;
      const orbitRy = orbitRx * 0.55;
      const autoRot = t * ANIM_INTERVAL * 0.00005;
      const rot = autoRot + rotationRef.current;

      const centerX = CX + px;
      const centerY = CY + py;

      return effectiveZones.map((z, i) => {
        const baseAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const angle = baseAngle + rot;
        const x = centerX + Math.cos(angle) * orbitRx;
        const y = centerY + Math.sin(angle) * orbitRy;
        const z3d = (Math.sin(angle) + 1) * 0.5; // 0=back, 1=front
        const baseSize = Math.min(W, H) * (0.025 + z3d * 0.02) * scale;
        const pulse = 1 + Math.sin(t * 0.08 + angle * 3) * 0.05;
        const planetR = baseSize * pulse;
        const color = z.color || zoneColors[z.name] || "#888";
        const count = taskCounts[z.id] || 0;

        return {
          zone: z,
          x,
          y,
          z3d,
          planetR,
          color,
          angle,
          count,
          orbitCenterX: centerX,
          orbitCenterY: centerY,
          orbitRx,
          orbitRy,
        };
      });
    },
    [effectiveZones, taskCounts, W, H, CX, CY]
  );

  // Find planet nearest to tap coordinates
  const findNearestPlanet = useCallback(
    (tapX: number, tapY: number) => {
      const planets = computePlanets(tickRef.current);
      let closest: (typeof planets)[0] | null = null;
      let closestDist = Infinity;
      for (const p of planets) {
        const dx = tapX - p.x;
        const dy = tapY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = Math.max(p.planetR * 3, 30); // generous hit area
        if (dist < hitRadius && dist < closestDist) {
          closestDist = dist;
          closest = p;
        }
      }
      return closest;
    },
    [computePlanets]
  );

  const handleSingleTap = useCallback(
    (x: number, y: number) => {
      const planet = findNearestPlanet(x, y);
      if (planet && onPlanetTap) {
        onPlanetTap(planet.zone);
      }
    },
    [findNearestPlanet, onPlanetTap]
  );

  const handleDoubleTap = useCallback(
    (x: number, y: number) => {
      const planet = findNearestPlanet(x, y);
      if (planet && onPlanetDoubleTap) {
        onPlanetDoubleTap(planet.zone);
        // Also zoom into the planet
        scaleRef.current = Math.min(3.0, scaleRef.current * 1.5);
        panXRef.current = CX - planet.x + panXRef.current;
        panYRef.current = CY - planet.y + panYRef.current;
      }
    },
    [findNearestPlanet, onPlanetDoubleTap, CX, CY]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const planets = computePlanets(tick);
  const sortedPlanets = [...planets].sort((a, b) => a.z3d - b.z3d);

  const scale = scaleRef.current;
  const px = panXRef.current;
  const py = panYRef.current;
  const centerX = CX + px;
  const centerY = CY + py;
  const orbitRx = planets[0]?.orbitRx || Math.min(W, H) * 0.28 * scale;
  const orbitRy = planets[0]?.orbitRy || orbitRx * 0.55;

  // ── Web: mouse-wheel zoom ────────────────────────────────────────────────
  const containerRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !containerRef.current) return;
    const node = containerRef.current as unknown as HTMLElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      scaleRef.current = Math.max(0.4, Math.min(3.0, scaleRef.current * delta));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <View ref={containerRef} style={styles.container} {...panResponder.panHandlers}>
      <Svg width={W} height={H} style={styles.svg}>
        <Defs>
          {/* Radial gradients for planet glows */}
          {effectiveZones.map((z) => {
            const [r, g, b] = hexToRgb(z.color || zoneColors[z.name] || "#888");
            return (
              <RadialGradient key={`glow-${z.id}`} id={`glow-${z.id}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={z.color || zoneColors[z.name] || "#888"} stopOpacity="0.35" />
                <Stop offset="50%" stopColor={z.color || zoneColors[z.name] || "#888"} stopOpacity="0.08" />
                <Stop offset="100%" stopColor={z.color || zoneColors[z.name] || "#888"} stopOpacity="0" />
              </RadialGradient>
            );
          })}
        </Defs>

        {/* ── Stars ──────────────────────────────────────────────────────── */}
        {STARS.map((s, i) => {
          const alpha =
            s.baseAlpha *
            (0.5 + 0.5 * Math.sin(s.phase + tick * s.speed));
          return (
            <Circle
              key={`star-${i}`}
              cx={s.x * W}
              cy={s.y * H}
              r={s.r}
              fill={`rgba(255,255,255,${alpha.toFixed(3)})`}
            />
          );
        })}

        {/* ── Orbit ellipse track ──────────────────────────────────────── */}
        <Ellipse
          cx={centerX}
          cy={centerY}
          rx={orbitRx}
          ry={orbitRy}
          fill="none"
          stroke="rgba(100,100,180,0.06)"
          strokeWidth={1}
          strokeDasharray="4,6"
        />

        {/* ── Neural connection lines ─────────────────────────────────── */}
        {planets.map((a, i) =>
          planets.slice(i + 1).map((b, j) => {
            const avgZ = (a.z3d + b.z3d) * 0.5;
            const alpha = (0.04 + avgZ * 0.11).toFixed(3);
            return (
              <Line
                key={`line-${i}-${i + 1 + j}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={`rgba(0,212,255,${alpha})`}
                strokeWidth={0.5 + avgZ * 0.8}
              />
            );
          })
        )}

        {/* ── Planets (sorted back-to-front for depth) ─────────────────── */}
        {sortedPlanets.map((p) => {
          const glowR = p.planetR * 4;
          const moonOrbit = p.planetR * 2.8;
          const moonCount = p.count;
          const [cr, cg, cb] = hexToRgb(p.color);

          return (
            <G key={`planet-${p.zone.id}`}>
              {/* Glow halo */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={glowR}
                fill={`url(#glow-${p.zone.id})`}
                opacity={0.5 + p.z3d * 0.5}
              />

              {/* Planet core */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={p.planetR}
                fill={p.color}
                opacity={0.85 + p.z3d * 0.15}
              />

              {/* Planet highlight (top-left specular) */}
              <Circle
                cx={p.x - p.planetR * 0.25}
                cy={p.y - p.planetR * 0.3}
                r={p.planetR * 0.4}
                fill="rgba(255,255,255,0.25)"
              />

              {/* Planet ring */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={p.planetR + 1.5}
                fill="none"
                stroke={`rgba(${cr},${cg},${cb},0.25)`}
                strokeWidth={1}
              />

              {/* ── Moons (orbiting dots) ─── */}
              {Array.from({ length: Math.min(moonCount, 8) }, (_, mi) => {
                const moonAngle =
                  (mi / Math.max(moonCount, 1)) * Math.PI * 2 +
                  tick * 0.04 * (mi % 2 === 0 ? 1 : -1); // alternate directions
                const mx = p.x + Math.cos(moonAngle) * moonOrbit;
                const my = p.y + Math.sin(moonAngle) * moonOrbit * 0.6;
                const moonSize = Math.max(1.5, 2.5 * scale);
                return (
                  <Circle
                    key={`moon-${p.zone.id}-${mi}`}
                    cx={mx}
                    cy={my}
                    r={moonSize}
                    fill="rgba(220,220,240,0.7)"
                  />
                );
              })}

              {/* ── Task count badge (above planet) ── */}
              {p.count > 0 && (
                <G>
                  <Circle
                    cx={p.x + p.planetR * 0.7}
                    cy={p.y - p.planetR * 0.9}
                    r={Math.max(8, 6 * scale)}
                    fill={p.color}
                    opacity={0.9}
                  />
                  <SvgText
                    x={p.x + p.planetR * 0.7}
                    y={p.y - p.planetR * 0.9 + 3.5}
                    fill="#050508"
                    fontSize={Math.max(8, 7 * scale)}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {p.count > 9 ? "9+" : p.count}
                  </SvgText>
                </G>
              )}

              {/* ── Zone label (below planet) ── */}
              <SvgText
                x={p.x}
                y={p.y + p.planetR + 14}
                fill={`rgba(${cr},${cg},${cb},${(0.4 + p.z3d * 0.5).toFixed(2)})`}
                fontSize={Math.max(9, 10 * scale)}
                fontWeight="600"
                textAnchor="middle"
                letterSpacing={0.5}
              >
                {p.zone.name}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  svg: {
    backgroundColor: "transparent",
  },
});
