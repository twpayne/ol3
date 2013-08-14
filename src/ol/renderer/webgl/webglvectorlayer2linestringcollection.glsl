//! NAMESPACE=ol.renderer.webgl.vectorlayer2.shader.LineStringCollection
//! CLASS=ol.renderer.webgl.vectorlayer2.shader.LineStringCollection


//! COMMON
//#version 100 // FIXME we should be able to uncomment this
#define PREMULTIPLY_BY_ALPHA true


//! VERTEX
// ---- Configuration

precision mediump float;

// ---- Interface

attribute vec2 PositionP;
attribute vec2 Position0;
attribute vec2 PositionN;
attribute float Control;

attribute vec2 Style;
float lineWidth = Style.x;

uniform mat4 Transform;
uniform vec2 PixelScale;

varying vec2 v_Style;
varying vec2 Surface;
varying float Invalidator;

// ---- Implementation

float removeHighbits(float x, float valueOfLowest) {
    return x - floor(x / valueOfLowest) * valueOfLowest;
}
float extractHighbits(float x, float valueOfLowest) {
    return floor(x / valueOfLowest);
}

float zeroToOne(float f) {
    return f != 0.0 ? f : 1.0;
}

vec2 ccwNormal(vec2 p) {
    return vec2(p.y, -p.x) / zeroToOne(length(p));
}

vec3 transform(vec2 p) {
    vec4 tmp = Transform * vec4(p, 0.0, 1.0);
    return tmp.xyz / tmp.w;
}


void main(void) {

    // Apply transform
    vec2 pP = transform(PositionP).xy;
    vec2 p0 = transform(Position0).xy;
    vec2 pN = transform(PositionN).xy;

    // Look at two successive edges and determine direction / factor
    vec2 eP = ccwNormal(p0 - pP);
    vec2 eN = ccwNormal(pN - p0);
    vec2 normal = normalize(eP + eN);

    // Account for mitering
    float width = lineWidth / zeroToOne(dot(eN, normal));

    // Decode edge control value to surface coordinates
    vec2 surface = vec2(extractHighbits(Control, 4.0),
                        removeHighbits(Control, 4.0));

    // ...where a special value invalidates the vertex
    float invalidator = max(surface.y - 2.0, 0.0);

    // Sign of the locally horizontal surface coordinate
    // tells us whether to go left or right
    width *= zeroToOne(surface.x - 1.0);

    // Transform
    vec4 vertex = Transform * vec4(Position0, 0.0, 1.0);
    vertex.xy += width * normal * PixelScale;

    // Store varyings
    gl_Position = vertex;
    Surface = surface;
    Invalidator = invalidator;
    v_Style = Style;
}


//! FRAGMENT
// ---- Configuration

precision mediump float;

// ---- Interface

varying vec2 Surface;
varying float Invalidator;

varying vec2 v_Style;
float lineWidth = v_Style.x;
float outlineWidth = v_Style.y;

vec4 FillColor = vec4(1.,0.,0.,1.);
vec4 StrokeColor = vec4(1.,1.,0.,1.);

//uniform vec3 RenderParams;
//float antiAliasing = RenderParams.x;
//float gamma = RenderParams.y;
//float rcpGamma = RenderParams.z;
const float antiAliasing = 1.5;
const float gamma = 2.3;
const float rcpGamma = 1./gamma;


// ---- Implementation

float blendCoeff(vec2 edge0, vec2 edge1, vec2 x) {
    vec2 weight = smoothstep(edge0, edge1, x);
    return max(weight.x, weight.y);
}

vec3 gammaApply(vec3 color) {
    return pow(abs(color), vec3(gamma));
}

vec3 gammaCorrect(vec3 color) {
    return pow(abs(color), vec3(rcpGamma));
}

void main(void) {

    if (Invalidator > 0.0) discard;

    // Determine distance vector from centerpoint (1;1) surface coordinates
    // the outer edge of the surface is located at 1
    vec2 dist = min(abs(Surface - vec2(1.0)), 1.0);

    // Determine surface scale from screen space derivatives
#ifdef STANDARD_DERIVATIVES
    vec2 dSurfPixX = dFdx(Surface), dSurfPixY = dFdy(Surface);
    vec2 scale = vec2(length(vec2(dSurfPixX.x, dSurfPixY.x)),
                      length(vec2(dSurfPixX.y, dSurfPixY.y)));
#else
    vec2 scale = vec2(1.0 / lineWidth);
#endif

    // Determine surface coordinate thresholds:
    //
    // 0.0                                     1.0
    // ... inside.. - edge =#{ border }#= edge -|
    //              |<---+-->|<-------+-------->|
    //              :   \|/  :       \|/        :
    //              :   /|\  :        |         :
    vec2 edgeWidth = antiAliasing * scale;
    //              :        :       /|\        :
    vec2 outline = outlineWidth * scale;
    //              :        :        :         :
    //              :        :        ^<--------|
    vec2 outerEdgeMin = vec2(1.0) - edgeWidth;
    //              ^<-------:--------|
    vec2 innerEdgeMin = outerEdgeMin - outline;
    //              |--------^
    vec2 innerEdgeMax = innerEdgeMin + edgeWidth;
    // When these   ^^^^^^^^^^        ^^^^^^^^^^^ two regions
    // overlap, the maximum intensity will be below 1.
    //
    // Both regions have the same width and provide the input to
    // the same monotonic function (x=0 for region start).
    //
    // => The result will never be blow zero, and
    // => there will be no jump discontinuities.
    // => maximum luminance at min(1.0, LineWidth / AntiAliasing)

    // Determine foreground color
    vec4 color = mix(FillColor, StrokeColor, blendCoeff(innerEdgeMin, innerEdgeMax, dist));

    // Adjust alpha for anti-aliasing on the outer edge
    color.a = color.a * (1.0 - blendCoeff(outerEdgeMin, vec2(1.0), dist));

    // Obviously - no implicit gamma correction happens on most platforms.
    // See: http://stackoverflow.com/questions/10843321
    //
    // This is only half of it - acutually the proper way would require
    // a finalizing rendering task, so that blending can be performed
    // in linearized color space.
    color.rgb = gammaCorrect(color.rgb);

#ifdef PREMULTIPLY_BY_ALPHA
    color.rgb *= color.a;
#endif
    gl_FragColor = color;
}
