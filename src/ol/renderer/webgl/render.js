goog.provide('ol.renderer.webgl.Render');



/**
 * @class
 * Abstract base - render SPI.
 *
 * Subclasses encapsulate a specific rendering pipeline configuration
 * which is activated by the renderer when interpretating the control
 * stream in order to render a number of primitives of same type and
 * vertex encoding.
 *
 * @constructor
 * @param {!ol.renderer.webgl.Batch.ControlStream.RenderType} type ID.
 * @param {!WebGLProgram} program Rendering pipeline to use.
 * @param {!ol.renderer.webgl.Render.VertexBufferFormat}
 *     vertexBufferFormat Vertex array layout.
 */
ol.renderer.webgl.Render = function(type, program, vertexBufferFormat) {

  /**
   * @type {!number}
   */
  this.type = type;

  /**
   * @type {!WebGLProgram}
   */
  this.program = program;

  /**
   * Array of arguments to glVertexAttribPointer.
   * @type {!ol.renderer.webgl.Render.VertexBufferFormat}
   */
  this.vertexBufferFormat = vertexBufferFormat;
};


/**
 * Set style.
 *
 * @param {!WebGLRenderingContext} gl GL.
 * @param {!ol.renderer.webgl.Batch.ControlStream} controlStream
 *      Control stream.
 * @param {!number} offset Start index of the encoded style values in the
 *      control stream.
 * @return {!number} Control stream index pointing to the last consumed
 *      style value.
 */
ol.renderer.webgl.Render.prototype.setStyle = goog.abstractMethod;


/**
 * Set uniforms.
 *
 * @param {!WebGLRenderingContext} gl GL.
 * @param {!ol.renderer.webgl.Render.Parameters} params Parameters.
 */
ol.renderer.webgl.Render.prototype.setUniforms = goog.abstractMethod;


/**
 * Format of vertex arrays, described as arguments to
 * gl.vertexAttribPointer.
 *
 * @typedef {!Array.<!Array>}
 */
ol.renderer.webgl.Render.VertexBufferFormat = undefined;


/**
 * Global parameters that subclasses can use to configure uniforms.
 *
 * @typedef {Array}
 */
ol.renderer.webgl.Render.Parameters = undefined;


/**
 * Semantic indices of the elements in the parameter vector.
 *
 * @enum {!number}
 */
ol.renderer.webgl.Render.Parameter = {
  /**
   * An array of two values that describe the size of a pixel in
   * normalized device coordinates.
   */
  NDC_PIXEL_SIZE: 0,

  /**
   * The transformation matrix as an array of 16 numbers in column
   * major order.
   */
  COORDINATE_TRANSFORM: 1,

  /**
   * "Relative to eye" translation (applied before the transformation
   * matrix for high precision support) encoded as a flat array of two
   * xyz vectors.
   */
  RTE_PRETRANSLATION: 2,

  /**
   * Real-valued number of pixels to use for edge smoothing.
   */
  SMOOTHING_PIXELS: 3,

  /**
   * Assumed gamma value of the display.
   */
  GAMMA: 4
};

