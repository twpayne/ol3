//! NAMESPACE=ol.renderer.webgl.vectorlayer2.shader.LineStringCollection
//! CLASS=ol.renderer.webgl.vectorlayer2.shader.LineStringCollection


//! COMMON
//#version 100 // FIXME we should be able to uncomment this
#define PREMULTIPLY_BY_ALPHA true


//! VERTEX

// ---- Configuration

precision highp float;

// ---- Interface

attribute vec2 PositionP;
attribute vec2 Position0;
attribute vec2 PositionN;
attribute float Control;

attribute vec4 Style;
// width
// color (rgb)
// opacity (floor 0..255), outline width (fract)
// stroke color (rgb)


uniform mat4 Transform;
uniform vec2 PixelScale;

uniform vec3 RenderParams;
float antiAliasing = RenderParams.x;
//-float gamma = RenderParams.y; - used in fragment shader
//-float rcpGamma = RenderParams.z; - used in fragment shader

varying vec4 Surface; // (2d coords, invalidate, opacity)
varying vec4 Color_NegHorizSurfScale;
varying vec4 StrokeColor_Cutoff;


// ---- Implementation

vec3 decodeRGB(float v) {

    const float downshift16 = 1. / 65536.;
    const float downshift8  = 1. /   256.;

    return vec3(fract(v * downshift16), 
                fract(v * downshift8),
                fract(v));
}

vec2 rotateCw(vec2 p) {
    return vec2(p.y, -p.x);
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
    gl_Position = Transform * vec4(Position0, 0.0, 1.0);

    Surface = vec4(0., 0., 0., 0.);
    if (Control == 12.0) {
        Surface.z = 1.0; // invalidate surface
        return;
    }

    // Decode colors and opacity from style
    Color_NegHorizSurfScale.rgb = decodeRGB(Style.y);
    StrokeColor_Cutoff.rgb = decodeRGB(Style.w);
    Surface.w = floor(Style.z) / 255.0;

    // Decode line widths from style and prepare for rendering
    float extent = Style.x * 0.5;
    float actExtent = extent + antiAliasing * 0.5;
    Color_NegHorizSurfScale.w = -1.0 / actExtent;
    float strokeCutoff = fract(Style.z) * (extent + antiAliasing * 1.5);
    StrokeColor_Cutoff.w = strokeCutoff;

    // Done when not at edge, otherwise the above output
    // provides default values assumed in the code below
    if (Control == 0.0) return;

    // TODO short circuiting can happen even earlier for entirely
    // inner vertices of polygons, also have to extrude the ones
    // at inner vertices of polygon edges

    // Perform additional transforms
    vec2 pN = perspDiv(Transform * vec4(PositionN, 0.0, 1.0)).xy;
    vec2 p0 = perspDiv(gl_Position).xy;
    vec2 pP = perspDiv(Transform * vec4(PositionP, 0.0, 1.0)).xy;

    // Determine tangents of adjacent edges and at vertex
    vec2 tP = safeNormalize(p0-pP);
    vec2 tN = safeNormalize(pN-p0);
    vec2 tangent = tP + tN;

    vec2 displacement = vec2(0.0);

    // Determine extrusion / surface coordinates in tangential direction
    // (only at start/end of a line strip, indicated via control flags)
    float ctrl = Control;
    if (ctrl >= 4.0) {
        // Vertical edge?

        if (ctrl >= 8.0) {
            ctrl -= 4.0; // bit removal - or half of it (see below)

            // Tangent is in opposite direction - correect it
            tangent = -tangent;

            // Displacement towards the outside of the line
            displacement = (tP - tN) * max(strokeCutoff, antiAliasing);

            // Let surface coordinate indicate the edge (can use the
            // same value for both ends as interpolating towards zero in
            // all cases - subdivision is inherent)
            Surface.y = 1.0;
        }

        // Tangent used as reference for mitering is either in opposite
        // direction or zero - correct it
        tP = tangent;

        ctrl -= 4.0; // bit removal - done odd to ease data dependencies
    }

    // Determine extrusion / surface coordinate in normal directions
    vec2 normal = normalize(rotateCw(tangent));
    Surface.x = ctrl * 2.0 - 3.0;
    float horizExtent = actExtent /
            dot(rotateCw(tP), normal) *     // projected along miter
            Surface.x;                      // sign: left or right

    displacement += horizExtent * normal; 
    gl_Position.xy += gl_Position.w * displacement * PixelScale;
}


//! FRAGMENT


// ---- Configuration

precision mediump float;

// ---- Interface

uniform vec3 RenderParams;
float antiAliasing = RenderParams.x;
float gamma = RenderParams.y;
float rcpGamma = RenderParams.z;

varying vec4 Surface; // (2d coords, invalidate, opacity)
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

    if (Surface.z > 0.0) discard;

    // Distance from center of surface coordinate (keep it this way;
    // strangely the 'abs' function does not work correctly on all
    // platforms here)
    vec2 dist = min(Surface.xy * sign(Surface.xy), 1.0);

    // Determine thresholds in surface coordinates
    //
    // 0.0             1.0
    // |-----------------|
    // 
    // +--- extent ---+
    //     incl. aa / 2  :
    //                   :
    //           |<------| stroke cutoff
    //           :
    //           |aa->
    //           |---|
    // inner edge min / max
    // 
    //              |<-aa|
    // outer edge min
    //
    float strokeCutoff = StrokeColor_Cutoff.w; // scaled stroke width

#ifndef STANDARD_DERIVATIVES
    vec2 negScale = vec2(Color_NegHorizSurfScale.w, 
                         -1.0 / max(strokeCutoff, antiAliasing));
#else
    // with this extension can determine the gradient length of
    // each surface coordinate component in pixels
    vec2 dSurfPixX = dFdx(Surface.xy), dSurfPixY = dFdy(Surface.xy);
    vec2 negScale = vec2(-length(vec2(dSurfPixX.x, dSurfPixY.x)),
                         -length(vec2(dSurfPixX.y, dSurfPixY.y)));
#endif

    vec2 negAntiAlias = negScale * antiAliasing;
    vec2 innerEdgeMin = negScale * strokeCutoff + vec2(1.0);
    vec2 innerEdgeMax = innerEdgeMin - negAntiAlias;
    vec2 outerEdgeMin = negAntiAlias + vec2(1.0);

    // Blend with stroke color (smooth, inner edge)
    vec3 color = mix(Color_NegHorizSurfScale.rgb, StrokeColor_Cutoff.rgb,
                     blendCoeff(innerEdgeMin, innerEdgeMax, dist));

    // Adjust alpha for edge smoothing (outer edge)
    float alpha = Surface.a  * (1.0 - blendCoeff(outerEdgeMin, vec2(1.0), dist));

    // Gamma correct here (for now - we'd ideally want to blend in 
    // a linearized color space)
    color = gammaCorrect(color);

#ifdef PREMULTIPLY_BY_ALPHA
    color.rgb *= alpha;
#endif

    gl_FragColor = vec4(color, alpha);
}
