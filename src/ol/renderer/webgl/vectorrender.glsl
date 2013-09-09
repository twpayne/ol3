//! NAMESPACE=ol.renderer.webgl.VectorRenderShader
//! CLASS=ol.renderer.webgl.VectorRenderShader

//! COMMON


//! VERTEX

precision highp float;

// ---- Interface

attribute vec4 PositionP;
attribute vec4 Position0;
attribute vec4 PositionN;
attribute float Control;

attribute vec4 Style;
// extent
// color (rgb)
// opacity (floor 0..255), outline width (fract)
// stroke color (rgb)

uniform vec4 Pretranslation;
uniform mat4 Transform;
uniform vec2 PixelScale;

uniform vec3 RenderParams;
float antiAliasing = RenderParams.x;
//-float gamma = RenderParams.y; - used in fragment shader
//-float rcpGamma = RenderParams.z; - used in fragment shader

varying vec3 Surface_Opacity;
varying vec4 Color_NegHorizSurfScale;
varying vec4 StrokeColor_Cutoff;


// ---- Implementation

vec4 pretranslate(vec4 highPrecEncodedCoord) {
  vec4 v = highPrecEncodedCoord + Pretranslation;
  v.xy += v.zw;
  v.zw = vec2(0.0, 1.0);
  return v;
}

vec3 decodeRGB(float v) {

  const float downshift16 = 1. / 65536.;
  const float downshift8  = 1. /   256.;

  return vec3(fract(v * downshift16), 
    fract(v * downshift8), fract(v));
}

vec2 rotateCw(vec2 p) {
  return vec2(p.y, -p.x);
}

vec2 rotateCcw(vec2 p) {
  return vec2(-p.y, p.x);
}

vec3 perspDiv(vec4 p) {
  return p.xyz / p.w;
}

vec2 safeNormalize(vec2 v) {
  float frob = dot(v, v);
  return v * (frob > 0.0 ? inversesqrt(frob) : 0.0);
}

void main(void) {

  // Basic vertex shader operation
  gl_Position = Transform * pretranslate(Position0);

  // Decode colors and opacity from style
  Color_NegHorizSurfScale.rgb = decodeRGB(Style.y);
  StrokeColor_Cutoff.rgb = decodeRGB(Style.w);
  float lineMode = max(sign(Style.z), 0.0);
  float alphaAndWidth = Style.z * sign(Style.z);
  Surface_Opacity = vec3(-lineMode, 0.0, floor(alphaAndWidth) / 255.0);

  // Decode line widths from style and prepare for rendering
  float extent = Style.x * (0.5 + lineMode * 0.5);
  float actExtent = extent + antiAliasing * 0.5;
  Color_NegHorizSurfScale.w = -1.0 / actExtent;
  float strokeCutoff = fract(alphaAndWidth) * (extent + antiAliasing * 1.5);
  StrokeColor_Cutoff.w = strokeCutoff;

  if (Control >= 16.0) return;

  // Perform additional transforms
  vec2 pN = perspDiv(Transform * pretranslate(PositionN)).xy;
  vec2 p0 = perspDiv(gl_Position).xy;
  vec2 pP = perspDiv(Transform * pretranslate(PositionP)).xy;

  // Determine tangents of adjacent edges and at vertex
  vec2 tP = safeNormalize(p0 - pP);
  vec2 tN = safeNormalize(pN - p0);

  // Vertex normal when normalized or degenerates to tangent for line
  // endings
  vec2 normalOut = tP - tN;

  // Determine extrusion / surface coordinates in tangential direction
  // (only at start/end of a line strip, indicated via control flags)
  float ctrl = Control;

  float tangentialExtrusion = 0.0;
  if (ctrl >= 8.0) {
    ctrl -= 8.0;

    // Displacement towards the outside of the line
    tangentialExtrusion = max(strokeCutoff, antiAliasing);

    // Let surface coordinate indicate the edge (can use the
    // same value for both ends as interpolating towards zero in
    // all cases - subdivision is inherent)
    Surface_Opacity.y = 1.0;

    actExtent *= -1.0;
  }

  // Surface coordinate
  if (ctrl >= 4.0) {
    ctrl -= 4.0;
    Surface_Opacity.x = 1.0;
    actExtent *= -1.0;
  }

  // Select source for extrusion in normal direction
  vec2 normal = vec2(0.0);
  if (ctrl == 0.0) {
    normal = rotateCcw(tP);
  } else if (ctrl == 2.0) {
    normal = rotateCcw(tN);
  } else if (ctrl == 1.0 || ctrl == 3.0) {
    normal = normalize(normalOut);
    actExtent = (ctrl - 2.0) * abs(actExtent  /
            dot(normal, rotateCcw(tP)));
  } 

  vec2 displacement = tangentialExtrusion * normalOut + actExtent * normal; 
  gl_Position.xy += gl_Position.w * displacement * PixelScale;
}

//! FRAGMENT
//! JSCONST PREMULTIPLY_BY_ALPHA Number(gl.getContextAttributes().premultipliedAlpha)

precision mediump float;

// ---- Interface

uniform vec3 RenderParams;
float antiAliasing = RenderParams.x;
float gamma = RenderParams.y;
float rcpGamma = RenderParams.z;

varying vec3 Surface_Opacity; // (2d coords, invalidate, opacity)
varying vec4 Color_NegHorizSurfScale;
varying vec4 StrokeColor_Cutoff;

// ---- Implementation

float blendCoeff(vec2 edge0, vec2 edge1, vec2 x) {
  vec2 weight = smoothstep(edge0, edge1, x);
  return max(weight.x, weight.y);
}

vec3 gammaApply(vec3 color) {
  return pow(clamp(color, 0.0, 1.0), vec3(gamma));
}

vec3 gammaCorrect(vec3 color) {
  return pow(clamp(color, 0.0, 1.0), vec3(rcpGamma));
}


void main(void) {

  // Distance from center of surface coordinate (keep it this way;
  // strangely the 'abs' function does not work correctly on all
  // platforms here)
  vec2 dist = min(Surface_Opacity.xy * sign(Surface_Opacity.xy), 1.0);

  // Determine thresholds in surface coordinates
  //
  // 0.0         1.0
  // |-----------------|
  // 
  // +--- extent ---+
  //     incl. aa / 2  :
  //           :
  //       |<------| stroke cutoff
  //       :
  //       |aa->
  //       |---|
  // inner edge min / max
  // 
  //        |<-aa|
  // outer edge min
  //
  float strokeCutoff = StrokeColor_Cutoff.w; // scaled stroke width

#ifndef STANDARD_DERIVATIVES
  vec2 negScale = vec2(
      Color_NegHorizSurfScale.w, 
      -1.0 / max(strokeCutoff, antiAliasing));
#else
  // with this extension can determine the gradient length of
  // each surface coordinate component in pixels
  vec2 dSurfPixX = dFdx(Surface_Opacity.xy), dSurfPixY = dFdy(Surface_Opacity.xy);
  vec2 negScale = vec2(
      -length(vec2(dSurfPixX.x, dSurfPixY.x)),
      -length(vec2(dSurfPixX.y, dSurfPixY.y)));
  // FIXME Currently out of sync with scale requirements...
#endif

  vec2 negAntiAlias = negScale * antiAliasing;
  vec2 innerEdgeMin = negScale * strokeCutoff + vec2(1.0);
  vec2 innerEdgeMax = innerEdgeMin - negAntiAlias;
  vec2 outerEdgeMin = negAntiAlias + vec2(1.0);

  // Blend with stroke color (smooth, inner edge)
  vec3 color = mix(
      Color_NegHorizSurfScale.rgb, StrokeColor_Cutoff.rgb,
      blendCoeff(innerEdgeMin, innerEdgeMax, dist));

  // Adjust alpha for edge smoothing (outer edge)
  float alpha = Surface_Opacity.z  * (1.0 - blendCoeff(outerEdgeMin, vec2(1.0), dist));

  // Gamma correct here (for now - we'd ideally want to blend in 
  // a linearized color space)
  color = gammaCorrect(color);

#if PREMULTIPLY_BY_ALPHA
  color.rgb *= alpha;
#endif
  gl_FragColor = vec4(color, alpha);
}

