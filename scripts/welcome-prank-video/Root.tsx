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
  doorHomeless: staticFile('door-homeless.jpg'),
  bed: staticFile('bed.jpg'),
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

function Streaks({ color = '#ffbd54', offset = 0 }: { color?: string; offset?: number }) {
  const frame = useCurrentFrame();
  const progress = fade(frame, 18 + offset, 62 + offset);
  const exit = fade(frame, 78 + offset, 98 + offset);
  const opacity = clamp(progress - exit, 0, 1);

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen' }}>
      {Array.from({ length: 14 }).map((_, index) => {
        const y = 650 + index * 42;
        const speed = 800 + index * 24;
        const x = interpolate(frame, [12 + offset, 92 + offset], [-380 - index * 28, speed], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y + Math.sin((frame + index * 11) / 9) * 28,
              width: 620,
              height: 5 + (index % 3) * 2,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, ${color}, rgba(255,255,255,0.98), transparent)`,
              filter: `blur(${index % 2 ? 1.2 : 0}px)`,
              transform: `rotate(${index % 2 ? -7 : 8}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Burst({ color = '#ffd66d', start = 54 }: { color?: string; start?: number }) {
  const frame = useCurrentFrame();
  const progress = fade(frame, start, start + 18);
  const exit = fade(frame, start + 40, start + 64);
  const opacity = clamp(progress - exit, 0, 1);
  const scale = interpolate(frame, [start, start + 50], [0.3, 1.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        mixBlendMode: 'screen',
        background: `radial-gradient(circle at 50% 46%, rgba(255,255,255,0.95) 0%, ${color} 8%, rgba(255,183,52,0.45) 22%, transparent 50%)`,
        transform: `scale(${scale})`,
      }}
    />
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
  const exit = fade(frame, 58, 76);

  return (
    <AbsoluteFill
      style={{
        opacity: 1 - exit,
        background: 'radial-gradient(circle at 50% 42%, #3c3426 0%, #151313 52%, #09090a 100%)',
      }}
    >
      <ParticleField start={0} />
      <ImageCard src={assets.semiOpenDoor} x={72} y={448} width={420} height={746} rotate={-2} delay={0} />
      <ImageCard src={assets.doorHomeless} x={588} y={420} width={420} height={746} rotate={2.5} delay={7} />
      <CssPlus />
      <Streaks />
    </AbsoluteFill>
  );
}

function DoorResult() {
  const frame = useCurrentFrame();
  const inOpacity = fade(frame, 54, 70);
  const outOpacity = 1 - fade(frame, 102, 122);

  return (
    <AbsoluteFill style={{ opacity: inOpacity * outOpacity, backgroundColor: '#09090a' }}>
      <FullFrameImage src={assets.doorHomeless} start={54} end={122} />
      <Burst start={56} />
      <ParticleField start={54} />
    </AbsoluteFill>
  );
}

function SecondCombination() {
  const frame = useCurrentFrame();
  const inOpacity = fade(frame, 104, 118);
  const outOpacity = 1 - fade(frame, 140, 158);
  const cardProgress = fade(frame, 108, 138);

  return (
    <AbsoluteFill style={{ opacity: inOpacity * outOpacity, backgroundColor: '#100d16' }}>
      <FullFrameImage src={assets.bed} start={104} end={158} opacity={0.82} />
      <ParticleField color="#e27bff" start={104} />
      <Streaks color="#db76ff" offset={92} />
      <div
        style={{
          position: 'absolute',
          left: 540 + cardProgress * 70,
          top: 360 - cardProgress * 80,
          width: 390,
          height: 692,
          overflow: 'hidden',
          borderRadius: 32,
          border: '4px solid rgba(255,255,255,0.9)',
          boxShadow: '0 34px 120px rgba(207,85,255,0.45)',
          transform: `rotate(${interpolate(cardProgress, [0, 1], [6, -2])}deg) scale(${interpolate(cardProgress, [0, 1], [0.85, 1.02])})`,
        }}
      >
        <Img src={assets.bedPrank} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <Burst color="#ee95ff" start={126} />
    </AbsoluteFill>
  );
}

function FinalMontage() {
  const frame = useCurrentFrame();
  const inOpacity = fade(frame, 146, 160);
  const flash = 1 - fade(frame, 160, 172);

  return (
    <AbsoluteFill style={{ opacity: inOpacity, backgroundColor: '#0b0b0d' }}>
      <FullFrameImage src={assets.bedPrank} start={146} end={180} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 52% 44%, rgba(255,255,255,${0.38 * flash}) 0%, rgba(255,219,114,${0.12 * flash}) 24%, transparent 58%)`,
          mixBlendMode: 'screen',
        }}
      />
      <ParticleField color="#fff0a6" start={146} />
      <div
        style={{
          position: 'absolute',
          right: 46,
          bottom: 70,
          width: 245,
          height: 436,
          overflow: 'hidden',
          borderRadius: 28,
          border: '3px solid rgba(255,255,255,0.82)',
          boxShadow: '0 18px 70px rgba(0,0,0,0.52)',
          transform: `translateY(${interpolate(frame, [150, 180], [44, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px) rotate(3deg)`,
        }}
      >
        <Img src={assets.doorHomeless} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
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

