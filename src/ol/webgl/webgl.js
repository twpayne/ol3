goog.provide('ol.webgl');
goog.provide('ol.webgl.SUPPORTED');
goog.provide('ol.webgl.WebGLContextEventType');

goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.webgl');


/**
 * @const
 * @private
 * @type {Array.<string>}
 */
ol.webgl.CONTEXT_IDS_ = [
  'webgl',
  'webgl-experimental',
  'webkit-3d',
  'moz-webgl'
];


/**
 * @enum {string}
 */
ol.webgl.WebGLContextEventType = {
  LOST: 'webglcontextlost',
  RESTORED: 'webglcontextrestored'
};


/**
 * @param {WebGLRenderingContext} gl Context.
 * @param {WebGLProgram} program Program.
 * @return {Array.<WebGLActiveInfo>} Active attributes.
 */
ol.webgl.getActiveAttributes = function(gl, program) {
  var n = /** @type {number} */ (
      gl.getProgramParameter(program, goog.webgl.ACTIVE_ATTRIBUTES));
  var result = new Array(n);
  var i;
  for (i = 0; i < n; ++i) {
    result[i] = gl.getActiveAttrib(program, i);
  }
  return result;
};


/**
 * @param {WebGLRenderingContext} gl Context.
 * @param {WebGLProgram} program Program.
 * @return {Array.<WebGLActiveInfo>} Active uniforms.
 */
ol.webgl.getActiveUniforms = function(gl, program) {
  var n = /** @type {number} */ (
      gl.getProgramParameter(program, goog.webgl.ACTIVE_UNIFORMS));
  var result = new Array(n);
  var i;
  for (i = 0; i < n; ++i) {
    result[i] = gl.getActiveUniform(program, i);
  }
  return result;
};


/**
 * @param {Element} canvas Canvas.
 * @param {Object=} opt_attributes Attributes.
 * @return {WebGLRenderingContext} WebGL rendering context.
 */
ol.webgl.getContext = function(canvas, opt_attributes) {
  var context, i, ii = ol.webgl.CONTEXT_IDS_.length;
  for (i = 0; i < ii; ++i) {
    try {
      context = canvas.getContext(ol.webgl.CONTEXT_IDS_[i], opt_attributes);
      if (!goog.isNull(context)) {
        return context;
      }
    } catch (e) {
    }
  }
  return null;
};


/**
 * Is supported.
 * @const
 * @type {boolean}
 */
ol.webgl.SUPPORTED = (function() {
  if (!('WebGLRenderingContext' in goog.global)) {
    return false;
  }
  try {
    var canvas = goog.dom.createElement(goog.dom.TagName.CANVAS);
    return !goog.isNull(ol.webgl.getContext(canvas));
  } catch (e) {
    return false;
  }
})();
