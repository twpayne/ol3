goog.provide('ol.renderer.webgl.Batch');


/**
 * Ready-to-render batch.
 *
 * The contained data has been uploaded to the GPU and can
 * only be accessed remotely using appropriate API calls.
 *
 * @typedef {{
 *   controlStream: ol.renderer.webgl.Batch.ControlStream,
 *   indexBuffer: WebGLBuffer,
 *   vertexBuffer: WebGLBuffer
 * }} ol.renderer.webgl.Batch
 */
ol.renderer.webgl.Batch = {};


/**
 * Host-side representation of a batch.
 *
 * @typedef {{
 *   controlStream: !ol.renderer.webgl.Batch.ControlStream,
 *   indexData: !Uint16Array,
 *   vertexData: !Float32Array
 * }} ol.renderer.webgl.Batch.Blueprint
 */
ol.renderer.webgl.Batch.Blueprint = {};


/**
 * A flat array of numbers that represent rendering instructions
 * each followed by its arguments.
 * A typed array is used to reduce the host-side memory footprint.
 *
 * @typedef {(Array|Float32Array)} ol.renderer.webgl.BatchData.ControlStream
 */
ol.renderer.webgl.Batch.ControlStream = {};


/**
 * Control stream instruction.
 *
 * @enum {!number}
 */
ol.renderer.webgl.Batch.ControlStream.Instruction = {
  /**
   * Selects the rendering configuration. Followed by two
   * arguments; the render type and the byte offset to use
   * for the vertex buffer.
   *
   * @see {ol.renderer.webgl.Batch.ControlStream.RenderType}
   */
  CONFIGURE: 0,
  /**
   * Sets the style for the primitives to be rendered.
   * Followed by four arguments that encode the style.
   */
  SET_STYLE: 1,
  /**
   * Dereferences a range within the index buffer.
   * The single argument specifies the number of indices to
   * be dereferenced.
   * Ranges are assumed to be tightly packed, so the offset
   * is determined from instructions in the control stream,
   * where a 'DRAW_ELEMENTS' instructions sets the offset
   * behind the last element dereferenced and selection of
   * a new index buffer resets the offset to zero.
   */
  DRAW_ELEMENTS: 2
};


/**
 * Type of render.
 * Enumeration of concrete classes derived from Render.
 *
 * @enum {!number}
 * @see {ol.renderer.webgl.Render}
 */
ol.renderer.webgl.Batch.ControlStream.RenderType = {
  /**
   * Rendering configuration for line primitives.
   */
  LINES: 0,
  /**
   * Rendering configuration for polygon primitives.
   */
  POLYGONS: 1
};

