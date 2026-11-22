import { CAMERA_HEIGHT, HORIZON, MAX_DISTANCE, RIPPLE_SLOTS } from './waveCamera'

const f = (n: number) => n.toFixed(4)

/** One triangle that covers the whole screen; cheaper than a two-triangle quad. */
export const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

/**
 * The sea. For every pixel: cast a ray from a camera above a flat plane, sum a
 * few travelling sine waves (plus pointer ripples) to get a height and slope,
 * then light it like water: Fresnel mix of a deep color and the reflected sky,
 * a sun or moon highlight, foam on crests and fog toward the horizon.
 * Written for WebGL 1 (GLSL ES 1.00) so older phones run it too.
 */
export const FRAGMENT_SHADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform float uSway;
uniform vec2 uHover;
uniform float uHoverStrength;
uniform vec3 uRipples[${RIPPLE_SLOTS}];

uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform vec3 uLightColor;
uniform vec3 uLightDir;
uniform float uLightDisc;

const float HORIZON = ${f(HORIZON)};
const float CAMERA_HEIGHT = ${f(CAMERA_HEIGHT)};
const float MAX_DISTANCE = ${f(MAX_DISTANCE)};

vec3 sky(vec3 rd) {
  float up = clamp(rd.y, 0.0, 1.0);
  vec3 color = mix(uSkyHorizon, uSkyTop, sqrt(up));
  float facing = max(dot(rd, uLightDir), 0.0);
  color += uLightColor * (pow(facing, 1400.0) * uLightDisc + pow(facing, 18.0) * 0.22);
  return color;
}

// Adds one wave. Squaring the sine sharpens crests and flattens troughs.
void wave(vec2 p, vec2 dir, float freq, float amp, float speed, inout float h, inout vec2 slope) {
  float phase = dot(p, dir) * freq + uTime * speed;
  float s = sin(phase) * 0.5 + 0.5;
  h += amp * s * s;
  slope += dir * (amp * s * cos(phase) * freq);
}

void ripple(vec2 p, vec2 center, float age, float amp, float freq, inout float h, inout vec2 slope) {
  vec2 offset = p - center;
  float dist = length(offset) + 0.0001;
  float ring = dist - age * 2.4;
  float envelope = exp(-ring * ring * 1.2) * exp(-age * 0.75) * amp;
  float phase = ring * freq;
  h += envelope * sin(phase);
  slope += (offset / dist) * (envelope * freq * cos(phase));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec3 rd = normalize(vec3(uv.x + uSway, uv.y - HORIZON, 1.0));

  if (rd.y >= -0.0005) {
    gl_FragColor = vec4(sky(rd), 1.0);
    return;
  }

  float below = HORIZON - uv.y;
  float z = CAMERA_HEIGHT / below;
  vec2 p = vec2((uv.x + uSway) * z, z);
  float dist = min(length(vec3(p.x, CAMERA_HEIGHT, p.y)), MAX_DISTANCE * 3.0);

  float h = 0.0;
  vec2 slope = vec2(0.0);
  wave(p, vec2(0.80, 0.60), 0.32, 0.34, 0.85, h, slope);
  wave(p, vec2(-0.60, 0.80), 0.53, 0.17, 1.15, h, slope);
  wave(p, vec2(0.20, 0.98), 1.07, 0.08, 1.65, h, slope);
  wave(p, vec2(0.98, -0.20), 1.85, 0.04, 2.25, h, slope);
  wave(p, vec2(-0.91, -0.41), 3.10, 0.02, 2.95, h, slope);
  wave(p, vec2(0.51, 0.86), 4.70, 0.012, 3.60, h, slope);

  float hoverDist = length(p - uHover);
  float hover = exp(-hoverDist * 1.3) * uHoverStrength * 0.07;
  float hoverPhase = hoverDist * 6.5 - uTime * 4.5;
  h += hover * sin(hoverPhase);
  slope += ((p - uHover) / (hoverDist + 0.0001)) * (hover * 6.5 * cos(hoverPhase));

  for (int i = 0; i < ${RIPPLE_SLOTS}; i++) {
    float age = uTime - uRipples[i].z;
    if (age > 0.0 && age < 6.0) {
      ripple(p, uRipples[i].xy, age, 0.14, 5.5, h, slope);
    }
  }

  // Far water gets calmer normals so the horizon does not shimmer.
  slope /= 1.0 + dist * 0.07;
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

  float cosView = max(dot(n, -rd), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosView, 5.0);
  vec3 r = reflect(rd, n);
  r.y = abs(r.y);
  vec3 reflected = sky(r);

  float lit = 0.55 + 0.45 * max(dot(n, uLightDir), 0.0);
  vec3 body = mix(uWaterDeep, uWaterShallow, clamp(h * 1.25 + 0.2, 0.0, 1.0)) * lit;
  vec3 color = mix(body, reflected, fresnel);

  float spec = pow(max(dot(r, uLightDir), 0.0), 220.0);
  color += uLightColor * spec * 1.6;
  color += vec3(0.85, 0.95, 1.0) * smoothstep(0.44, 0.62, h) * 0.12;

  color = mix(color, uSkyHorizon, 1.0 - exp(-dist * 0.03));
  gl_FragColor = vec4(color, 1.0);
}
`
