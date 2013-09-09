
goog.provide('ol.renderer.webgl.VectorRender');
goog.require('ol.renderer.webgl.Render');

// TODO Make abstract and create subclasses for lines and polygons
// TODO Factor related batch construction routines in here
// TODO Don't forget to tighten typing on the 'locations' parameter



/**
 * @class
 * @extends {ol.renderer.webgl.Render}
 * @constructor
 * @param {!ol.renderer.webgl.Batch.ControlStream.RenderType} type
 * @param {!WebGLProgram} program GL program.
 * @param {!Object} locations Program locations.
 */
ol.renderer.webgl.VectorRender = function(type, program, locations) {

  goog.base(this, type, program, [
    [locations.PositionP, 4, goog.webgl.FLOAT, false, 20, 0 * 4],
    [locations.Position0, 4, goog.webgl.FLOAT, false, 20, 15 * 4],
    [locations.PositionN, 4, goog.webgl.FLOAT, false, 20, 30 * 4],
    [locations.Control, 1, goog.webgl.FLOAT, false, 20, 19 * 4]
  ]);
  this.locations_ = locations;
};
goog.inherits(ol.renderer.webgl.VectorRender, ol.renderer.webgl.Render);


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorRender.prototype.setStyle =
    function(gl, controlStream, offset) {

  gl.vertexAttrib4f(
      this.locations_.Style,
      controlStream[offset + 0],
      controlStream[offset + 1],
      controlStream[offset + 2],
      controlStream[offset + 3]);

  return offset + 3;
};


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorRender.prototype.setUniforms =
    function(gl, params) {

  gl.uniformMatrix4fv(this.locations_.Transform, false,
      params[ol.renderer.webgl.Render.Parameter.COORDINATE_TRANSFORM]);

  gl.uniform2fv(this.locations_.PixelScale,
      params[ol.renderer.webgl.Render.Parameter.NDC_PIXEL_SIZE]);

  var gamma = params[ol.renderer.webgl.Render.Parameter.GAMMA];
  gl.uniform3f(this.locations_.RenderParams,
      params[ol.renderer.webgl.Render.Parameter.SMOOTHING_PIXELS],
      gamma, 1 / gamma);

  var pretranslation =
      params[ol.renderer.webgl.Render.Parameter.RTE_PRETRANSLATION];
  gl.uniform4f(this.locations_.Pretranslation,
      pretranslation[0], pretranslation[1],
      pretranslation[3], pretranslation[4]);
};

