import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
  registerRoot,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION_IN_FRAMES = 180;
const COMPOSITION_ID = 'WelcomeImagePrankPromo';

const assets = {
  semiOpenDoor: staticFile('semi-open-door.jpg'),
  homelessSource: staticFile('homeless-source.jpg'),
  doorHomeless: staticFile('door-homeless.jpg'),
  bed: staticFile('bed.jpg'),
  womanSource: staticFile('woman-source.jpg'),
  bedPrank: staticFile('bed-prank.jpg'),
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function fade(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function fullFrameTransform(frame: number, start: number, end: number, from = 1.04, to = 1.16) {
  const progress = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return `scale(${from + (to - from) * progress}) translate3d(${Math.sin(progress * Math.PI) * -18}px, ${progress * -22}px, 0)`;
}

function FullFrameImage({
  src,
  start,
  end,
  opacity = 1,
}: {
  src: string;
  start: number;
  end: number;
  opacity?: number;
}) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        opacity,
        overflow: 'hidden',
        backgroundColor: '#0d0d0f',
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: fullFrameTransform(frame, start, end),
          filter: 'contrast(1.08) saturate(1.08)',
        }}
      />
    </AbsoluteFill>
  );
}

function FocusedBedroomResult() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [146, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, [0, 1], [1.56, 1.82]);
  const translateX = interpolate(progress, [0, 1], [-372, -448]);
  const translateY = interpolate(progress, [0, 1], [104, 154]);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        backgroundColor: '#0d0d0f',
      }}
    >
      <Img
        src={assets.bedPrank}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
          filter: 'contrast(1.08) saturate(1.08)',
        }}
      />
    </AbsoluteFill>
  );
}

function ImageCard({
  src,
  x,
  y,
  width,
  height,
  rotate,
  delay,
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  delay: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 120 },
  });
  const scale = interpolate(entrance, [0, 1], [0.82, 1]);
  const translateY = interpolate(entrance, [0, 1], [90, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        overflow: 'hidden',
        borderRadius: 34,
        border: '4px solid rgba(255,255,255,0.88)',
        boxShadow: '0 32px 110px rgba(0,0,0,0.48)',
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale}) rotate(${rotate}deg)`,
        backgroundColor: '#111',
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
}

function CssPlus() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 506,
        top: 858,
        width: 70,
        height: 70,
        filter: 'drop-shadow(0 0 22px rgba(255,185,74,0.9))',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 29,
          top: 0,
          width: 12,
          height: 70,
          borderRadius: 999,
          background: '#fff3c4',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 29,
          width: 70,
          height: 12,
          borderRadius: 999,
          background: '#fff3c4',
        }}
      />
    </div>
  );
}

function Streaks({
  color = '#f0b24b',
  highlight = '#ffe2a1',
  offset = 0,
  lineCount = 12,
  baseOpacity = 0.5,
  highlightOpacity = 0.44,
}: {
  color?: string;
  highlight?: string;
  offset?: number;
  lineCount?: number;
  baseOpacity?: number;
  highlightOpacity?: number;
}) {
  const frame = useCurrentFrame();
  const progress = fade(frame, 4 + offset, 32 + offset);
  const exit = fade(frame, 78 + offset, 98 + offset);
  const opacity = clamp(progress - exit, 0, 1);
  const gradientOpacity = Math.min(0.78, baseOpacity + 0.24);

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen', pointerEvents: 'none' }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`streak-${offset}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="42%" stopColor={color} stopOpacity={gradientOpacity} />
            <stop offset="57%" stopColor={highlight} stopOpacity={Math.min(0.82, gradientOpacity + 0.16)} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: lineCount }).map((_, index) => {
          const y = 610 + index * 48;
          const travel = interpolate(frame, [12 + offset, 92 + offset], [-390 - index * 26, 910 + index * 20], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const wave = Math.sin((frame + index * 13) / 9) * 38;
          const curve = 44 + Math.sin((frame + index * 19) / 11) * 30;
          const sweep = -520 + ((frame * (17 + (index % 4) * 2) + index * 57) % 1040);
          const path = `M ${travel - 430} ${y + wave} C ${travel - 250} ${y - curve} ${travel + 88} ${y + curve} ${travel + 430} ${y - wave * 0.42}`;
          const linePulse = 0.48 + Math.sin((frame + index * 17) / 5.5) * 0.24;

          return (
            <g key={index}>
              <path
                d={path}
                fill="none"
                stroke={`url(#streak-${offset})`}
                strokeWidth={2.8 + (index % 3) * 0.8}
                strokeLinecap="round"
                opacity={linePulse * baseOpacity}
                filter="blur(0.7px)"
              />
              <path
                d={path}
                fill="none"
                stroke={highlight}
                strokeWidth={1.7 + (index % 2) * 0.45}
                strokeLinecap="round"
                strokeDasharray="120 560"
                strokeDashoffset={sweep}
                opacity={highlightOpacity + Math.sin((frame + index * 21) / 6) * 0.12}
                filter="blur(0.45px)"
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

function EdgeSnakeStreaks({ start = 56 }: { start?: number }) {
  const frame = useCurrentFrame();
  const progress = fade(frame, start, start + 18);
  const exit = fade(frame, start + 48, start + 66);
  const opacity = clamp(progress - exit, 0, 1);

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen', pointerEvents: 'none' }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="door-snake" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffd15c" stopOpacity="0" />
            <stop offset="42%" stopColor="#ffd15c" stopOpacity="0.66" />
            <stop offset="57%" stopColor="#fff4c9" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#ffd15c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 18 }).map((_, index) => {
          const side = index % 2 === 0 ? -1 : 1;
          const baseX = side === -1 ? 170 : 910;
          const baseY = 990 + (index % 6) * 88;
          const travel = interpolate(frame, [start, start + 58], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          });
          const wave = Math.sin((frame + index * 11) / 8) * 28;
          const sweep = -460 + ((frame * (18 + (index % 5) * 2) + index * 79) % 930);
          const startX = baseX + side * travel * (86 + index * 4);
          const endX = startX + side * (360 + (index % 4) * 54);
          const path = `M ${startX} ${baseY + wave} C ${startX + side * 126} ${baseY - 52} ${endX - side * 118} ${baseY + 54} ${endX} ${baseY - wave * 0.5}`;
          const pulse = 0.46 + Math.sin((frame + index * 19) / 5) * 0.22;

          return (
            <g key={index}>
              <path
                d={path}
                fill="none"
                stroke="url(#door-snake)"
                strokeWidth={4 + (index % 4)}
                strokeLinecap="round"
                opacity={pulse * 0.84}
                filter="blur(0.7px)"
              />
              <path
                d={path}
                fill="none"
                stroke="#fff6cf"
                strokeWidth={3 + (index % 2)}
                strokeLinecap="round"
                strokeDasharray="125 380"
                strokeDashoffset={sweep}
                opacity={0.66 + Math.sin((frame + index * 23) / 6) * 0.22}
                filter="blur(0.25px)"
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

function SideBloom({
  color = '#ffd66d',
  start = 54,
  x = 50,
  y = 74,
  radius = 34,
}: {
  color?: string;
  start?: number;
  x?: number;
  y?: number;
  radius?: number;
}) {
  const frame = useCurrentFrame();
  const progress = fade(frame, start, start + 18);
  const exit = fade(frame, start + 40, start + 64);
  const opacity = clamp(progress - exit, 0, 1);
  const scale = interpolate(frame, [start, start + 50], [0.55, 1.18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        mixBlendMode: 'screen',
        background: `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.82) 0%, ${color} 10%, rgba(255,183,52,0.28) 25%, transparent ${radius}%)`,
        transform: `scale(${scale})`,
      }}
    />
  );
}

function PinkEnergyBloom({ start = 126 }: { start?: number }) {
  const frame = useCurrentFrame();
  const progress = fade(frame, start, start + 18);
  const exit = fade(frame, start + 42, start + 62);
  const opacity = clamp(progress - exit, 0, 1);
  const drift = Math.sin((frame - start) / 12) * 34;
  const pulse = 0.78 + Math.sin((frame - start) / 7) * 0.12;

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen', pointerEvents: 'none' }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="pink-energy-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff0ff" stopOpacity="0.58" />
            <stop offset="24%" stopColor="#f8a5ff" stopOpacity="0.38" />
            <stop offset="58%" stopColor="#d66cff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#d66cff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pink-energy-wisp" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e77cff" stopOpacity="0" />
            <stop offset="45%" stopColor="#ffc7ff" stopOpacity="0.44" />
            <stop offset="100%" stopColor="#e77cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse
          cx={710 + drift}
          cy={1100 + Math.sin(frame / 10) * 22}
          rx={450 * pulse}
          ry={330 * pulse}
          fill="url(#pink-energy-core)"
          filter="blur(18px)"
        />
        <ellipse
          cx={865 - drift * 0.6}
          cy={870 + Math.sin(frame / 13) * 18}
          rx={300}
          ry={520}
          fill="url(#pink-energy-core)"
          opacity={0.42}
          filter="blur(24px)"
          transform={`rotate(-16 ${865 - drift * 0.6} ${870 + Math.sin(frame / 13) * 18})`}
        />
        {Array.from({ length: 8 }).map((_, index) => {
          const y = 780 + index * 82 + Math.sin((frame + index * 9) / 9) * 18;
          const sweep = -360 + ((frame * (16 + index) + index * 49) % 780);
          const path = `M ${-80 + drift * 0.2} ${y} C ${220} ${y - 54} ${620} ${y + 86} ${1160} ${y - 24}`;

          return (
            <g key={index}>
              <path
                d={path}
                fill="none"
                stroke="url(#pink-energy-wisp)"
                strokeWidth={4 + (index % 3)}
                strokeLinecap="round"
                opacity={0.42}
                filter="blur(0.8px)"
              />
              <path
                d={path}
                fill="none"
                stroke="#ffe1ff"
                strokeWidth={1.8 + (index % 2)}
                strokeLinecap="round"
                strokeDasharray="110 430"
                strokeDashoffset={sweep}
                opacity={0.44}
                filter="blur(0.25px)"
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

function DoorEdgeEnergy({ start = 56 }: { start?: number }) {
  const frame = useCurrentFrame();
  const progress = fade(frame, start, start + 18);
  const exit = fade(frame, start + 48, start + 66);
  const opacity = clamp(progress - exit, 0, 1);

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: -110,
          top: 1120,
          width: 560,
          height: 130,
          opacity: 0.56 + Math.sin(frame / 6) * 0.18,
          background: 'linear-gradient(90deg, transparent, rgba(255,205,72,0.66), rgba(255,246,188,0.42), transparent)',
          filter: 'blur(32px)',
          transform: `rotate(-24deg) translateX(${Math.sin(frame / 8) * 28}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -90,
          top: 980,
          width: 520,
          height: 120,
          opacity: 0.5 + Math.sin((frame + 13) / 7) * 0.16,
          background: 'linear-gradient(90deg, transparent, rgba(255,246,188,0.38), rgba(255,185,54,0.58), transparent)',
          filter: 'blur(30px)',
          transform: `rotate(18deg) translateX(${Math.sin(frame / 9) * -24}px)`,
        }}
      />
      <EdgeSnakeStreaks start={start} />
      {Array.from({ length: 28 }).map((_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const drift = frame - start;
        const size = 4 + (index % 4);

        return (
          <div
            key={`spark-${index}`}
            style={{
              position: 'absolute',
              left: (side === -1 ? 245 : 820) + Math.sin((drift + index * 7) / 5) * 56,
              top: 720 + ((index * 73) % 760) - drift * (1.8 + (index % 3) * 0.28),
              width: size,
              height: size,
              opacity: 0.5 + Math.sin((frame + index * 12) / 4) * 0.32,
              borderRadius: 999,
              backgroundColor: '#fff3b7',
              boxShadow: '0 0 18px #ffd265',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function ParticleField({ color = '#ffcf74', start = 0 }: { color?: string; start?: number }) {
  const frame = useCurrentFrame();
  const opacity = clamp(fade(frame, start, start + 18) - fade(frame, start + 130, start + 160), 0, 1);

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen' }}>
      {Array.from({ length: 58 }).map((_, index) => {
        const seed = index * 997;
        const baseX = (seed * 37) % WIDTH;
        const baseY = (seed * 71) % HEIGHT;
        const drift = frame - start;
        const size = 3 + (index % 5);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: baseX + Math.sin((drift + seed) / 18) * 46,
              top: baseY - drift * (0.8 + (index % 4) * 0.18),
              width: size,
              height: size,
              borderRadius: 999,
              backgroundColor: color,
              boxShadow: `0 0 ${12 + size * 2}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function FirstCombination() {
  const frame = useCurrentFrame();
  const exit = fade(frame, 43, 61);

  return (
    <AbsoluteFill
      style={{
        opacity: 1 - exit,
        background: 'radial-gradient(circle at 50% 42%, #3c3426 0%, #151313 52%, #09090a 100%)',
      }}
    >
      <ParticleField start={0} />
      <ImageCard src={assets.semiOpenDoor} x={72} y={448} width={420} height={746} rotate={-2} delay={0} />
      <ImageCard src={assets.homelessSource} x={588} y={420} width={420} height={746} rotate={2.5} delay={7} />
      <CssPlus />
      <Streaks />
    </AbsoluteFill>
  );
}

function DoorResult() {
  const frame = useCurrentFrame();
  const inOpacity = fade(frame, 43, 61);
  const outOpacity = 1 - fade(frame, 88, 108);

  return (
    <AbsoluteFill style={{ opacity: inOpacity * outOpacity, backgroundColor: '#09090a' }}>
      <FullFrameImage src={assets.doorHomeless} start={43} end={108} />
      <DoorEdgeEnergy start={48} />
      <ParticleField start={43} />
    </AbsoluteFill>
  );
}

function SecondCombination() {
  const frame = useCurrentFrame();
  const inOpacity = fade(frame, 89, 103);
  const outOpacity = 1 - fade(frame, 140, 158);
  const cardProgress = fade(frame, 93, 140);
  const cardLeft = interpolate(cardProgress, [0, 1], [540, 612]);
  const cardTop = interpolate(cardProgress, [0, 1], [330, 640]);

  return (
    <AbsoluteFill style={{ opacity: inOpacity * outOpacity, backgroundColor: '#100d16' }}>
      <FullFrameImage src={assets.bed} start={89} end={158} opacity={0.82} />
      <ParticleField color="#e27bff" start={89} />
      <Streaks color="#db76ff" highlight="#ffe1ff" offset={76} lineCount={9} baseOpacity={0.34} highlightOpacity={0.34} />
      <div
        style={{
          position: 'absolute',
          left: cardLeft,
          top: cardTop,
          width: 390,
          height: 692,
          overflow: 'hidden',
          borderRadius: 32,
          border: '4px solid rgba(255,255,255,0.9)',
          boxShadow: '0 34px 120px rgba(207,85,255,0.45)',
          transform: `rotate(${interpolate(cardProgress, [0, 1], [6, -2])}deg) scale(${interpolate(cardProgress, [0, 1], [0.85, 1.02])})`,
        }}
      >
        <Img src={assets.womanSource} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <PinkEnergyBloom start={116} />
    </AbsoluteFill>
  );
}

function FinalMontage() {
  const frame = useCurrentFrame();
  const inOpacity = fade(frame, 146, 160);
  const flash = 1 - fade(frame, 160, 172);

  return (
    <AbsoluteFill style={{ opacity: inOpacity, backgroundColor: '#0b0b0d' }}>
      <FocusedBedroomResult />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 52% 44%, rgba(255,255,255,${0.38 * flash}) 0%, rgba(255,219,114,${0.12 * flash}) 24%, transparent 58%)`,
          mixBlendMode: 'screen',
        }}
      />
      <ParticleField color="#fff0a6" start={146} />
    </AbsoluteFill>
  );
}

function WelcomeImagePrankPromo() {
  return (
    <AbsoluteFill style={{ backgroundColor: '#070709' }}>
      <Sequence from={0}>
        <FirstCombination />
      </Sequence>
      <Sequence from={0}>
        <DoorResult />
      </Sequence>
      <Sequence from={0}>
        <SecondCombination />
      </Sequence>
      <Sequence from={0}>
        <FinalMontage />
      </Sequence>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 180px rgba(0,0,0,0.55)',
        }}
      />
    </AbsoluteFill>
  );
}

function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={WelcomeImagePrankPromo}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}

registerRoot(RemotionRoot);
