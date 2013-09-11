goog.provide('ol.renderer.webgl.VectorLayer2');
goog.provide('ol.webglnew.geometry');

goog.require('goog.asserts');
goog.require('goog.vec.Mat4');
goog.require('goog.webgl');
goog.require('ol.Color');
goog.require('ol.math');
goog.require('ol.renderer.webgl.BatchBuilder');
goog.require('ol.renderer.webgl.BatchRenderer');
goog.require('ol.renderer.webgl.Layer');
goog.require('ol.renderer.webgl.Render');
goog.require('ol.renderer.webgl.VectorRender');
goog.require('ol.renderer.webgl.VectorRenderShader');
goog.require('ol.renderer.webgl.batch');
goog.require('ol.renderer.webgl.highPrecision');
goog.require('ol.renderer.webgl.testData');
goog.require('ol.renderer.webgl.vectorlayer2.shader.PointCollection');
goog.require('ol.style.LineLiteral');


/***
 * @typedef {{start: number,
 *            stop: number,
 *            style: ol.style.LineLiteral}}
 */
ol.LineStyleRange;



/**
 * @constructor
 * @extends {ol.renderer.webgl.Layer}
 * @param {ol.renderer.Map} mapRenderer Map renderer.
 * @param {ol.layer.Vector2} vectorLayer2 Vector layer.
 */
ol.renderer.webgl.VectorLayer2 = function(mapRenderer, vectorLayer2) {

  goog.base(this, mapRenderer, vectorLayer2);

  goog.vec.Mat4.makeIdentity(this.projectionMatrix);

  /**
   * @private
   * @type {!goog.vec.Mat4.Number}
   */
  this.modelViewMatrix_ = goog.vec.Mat4.createNumberIdentity();


  /**
   * @private
   * @type {?number}
   */
  this.framebufferDimension_ = null;

  /**
   * @private
   * @type {?ol.renderer.webgl.BatchRenderer}
   */
  this.batchRenderer_ = null;

  /**
   * @private
   * @type {ol.renderer.webgl.BatchBuilder}
   */
  this.batchBuilder_ = new ol.renderer.webgl.BatchBuilder(30, 160);

  /**
   * @private
   * @type {?ol.renderer.webgl.Batch}
   */
  this.batch_ = null;

  /**
   * @private
   * @type {ol.renderer.webgl.vectorlayer2.shader.PointCollection.Locations}
   */
  this.pointCollectionLocations_ = null;
};
goog.inherits(ol.renderer.webgl.VectorLayer2, ol.renderer.webgl.Layer);


/**
 * @param {ol.geom2.LineStringCollection} lineStrings Line strings.
 * @param {Array.<ol.style.LineLiteral>} styles Styles.
 * @return {Array.<ol.LineStyleRange>} Line style ranges.
 * @private
 */
ol.renderer.webgl.VectorLayer2.getLineStyleRanges_ =
    function(lineStrings, styles) {
  var n = lineStrings.getCount();
  goog.asserts.assert(styles.length == n);
  var lineStyleRanges = [];
  if (n !== 0) {
    var start = 0;
    var style = styles[0];
    var i;
    for (i = 1; i < n; ++i) {
      if (!styles[i].equals(style)) {
        lineStyleRanges.push({
          start: start,
          stop: i,
          style: style
        });
        start = i;
        style = styles[i];
      }
    }
    lineStyleRanges.push({
      start: start,
      stop: n,
      style: style
    });
  }
  return lineStyleRanges;
};


/**
 * @return {ol.layer.Vector2} Vector layer.
 */
ol.renderer.webgl.VectorLayer2.prototype.getVectorLayer = function() {
  return /** @type {ol.layer.Vector2} */ (this.getLayer());
};


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorLayer2.prototype.handleWebGLContextLost = function() {
  goog.base(this, 'handleWebGLContextLost');
  this.pointCollectionLocations_ = null;
};


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorLayer2.prototype.renderFrame =
    function(frameState, layerState) {

  var mapRenderer = this.getWebGLMapRenderer();
  var gl = mapRenderer.getGL();

  var view2DState = frameState.view2DState;

  var vectorLayer = this.getVectorLayer();
  var vectorSource = vectorLayer.getVectorSource();

  var size = frameState.size;
  var framebufferDimension = ol.math.roundUpToPowerOfTwo(
      Math.max(size[0], size[1]));

  this.bindFramebuffer(frameState, framebufferDimension);
  gl.viewport(0, 0, framebufferDimension, framebufferDimension);
  this.framebufferDimension_ = framebufferDimension;

  gl.clearColor(0, 0, 0, 0);
  gl.clear(goog.webgl.COLOR_BUFFER_BIT);
  gl.enable(goog.webgl.BLEND);

  goog.vec.Mat4.makeIdentity(this.modelViewMatrix_);
  if (view2DState.rotation !== 0) {
    goog.vec.Mat4.rotateZ(this.modelViewMatrix_, -view2DState.rotation);
  }
  goog.vec.Mat4.scale(this.modelViewMatrix_,
      2 / (framebufferDimension * view2DState.resolution),
      2 / (framebufferDimension * view2DState.resolution),
      1);
  goog.vec.Mat4.translate(this.modelViewMatrix_,
      -view2DState.center[0],
      -view2DState.center[1],
      0);

  var pointCollections = vectorSource.getPointCollections();
  if (pointCollections.length > 0) {
    this.renderPointCollections(pointCollections);
  }

  var batchRenderer = this.prepareBatchRenderer_();

  var batch = this.batch_;
  if (goog.isNull(batch)) {
    // TODO should also enter here when data has changed and...
    //
    // // Free resources of old version
    // if (! goog.isNull(this.batch_)) {
    //   ol.renderer.webgl.BatchRenderer_.unload(gl, this.batch_);
    // }

    this.renderPolygons();

    var lineStrings = vectorSource.getLineStrings();
    if (lineStrings.length > 0) {
      this.renderLineStrings(lineStrings);
    }

    // Upload batch
    var blueprint = this.batchBuilder_.releaseBlueprint();
    this.batch_ = batch =
        ol.renderer.webgl.BatchRenderer.upload(gl, blueprint);
  }

  // Render and forget the GL state (as there's rendering outside of it)
  batchRenderer.render(gl, batch);
  batchRenderer.reset(gl);

  goog.vec.Mat4.makeIdentity(this.texCoordMatrix);
  goog.vec.Mat4.translate(this.texCoordMatrix,
      0.5,
      0.5,
      0);
  goog.vec.Mat4.scale(this.texCoordMatrix,
      size[0] / framebufferDimension,
      size[1] / framebufferDimension,
      1);
  goog.vec.Mat4.translate(this.texCoordMatrix,
      -0.5,
      -0.5,
      0);

};


/**
 * @return {ol.renderer.webgl.BatchRenderer}
 * @private
 */
ol.renderer.webgl.VectorLayer2.prototype.prepareBatchRenderer_ =
    function() {

  var mapRenderer = this.getWebGLMapRenderer();
  var gl = mapRenderer.getGL();

  // Eventually create batch renderer

  var batchRenderer = this.batchRenderer_;
  if (goog.isNull(batchRenderer)) {

    var program = mapRenderer.getProgram(
        new ol.renderer.webgl.VectorRenderShaderFragment(gl),
        new ol.renderer.webgl.VectorRenderShaderVertex(gl));
    var locations = new ol.renderer.webgl.
        VectorRenderShader.Locations(gl, program);

    batchRenderer = new ol.renderer.webgl.BatchRenderer();
    // TODO Remove this glue code once the open ends are closed:
    // TODO There will be separate render / shader instances and we
    // TODO might want to factor their registration into the renderer
    batchRenderer.registerRender(
        new ol.renderer.webgl.VectorRender(
            ol.renderer.webgl.batch.ControlStreamRenderType.LINES,
            program, locations));
    batchRenderer.registerRender(
        new ol.renderer.webgl.VectorRender(
            ol.renderer.webgl.batch.ControlStreamRenderType.POLYGONS,
            program, locations));

    this.batchRenderer_ = batchRenderer;
  }

  // Set parameters

  var framebufferDimension = this.framebufferDimension_;
  batchRenderer.setParameter(
      ol.renderer.webgl.Render.Parameter.NDC_PIXEL_SIZE,
      [2 / framebufferDimension, 2 / framebufferDimension]);

  // Pull translation "before" the transform to increase precision
  var rteMatrix = [], rtePretranslation = [];
  ol.renderer.webgl.highPrecision.detachTranslation(
      rtePretranslation, rteMatrix, this.modelViewMatrix_);
  batchRenderer.setParameter(
      ol.renderer.webgl.Render.Parameter.RTE_PRETRANSLATION, rtePretranslation);
  batchRenderer.setParameter(
      ol.renderer.webgl.Render.Parameter.COORDINATE_TRANSFORM, rteMatrix);

  return batchRenderer;
};


/**
 */
ol.renderer.webgl.VectorLayer2.prototype.renderPolygons =
    function() {

  var batchBuilder = this.batchBuilder_;

  // Not part of the style - a global renderer parameter, this
  // dependency will be removed when splitting lines from polygons.
  var antiAliasing = 1.75; // TODO  remove me

  // Set style
  // TODO Get style data and replace this hard-wired hack
  var color = new ol.Color(0, 0, 255, 1);
  var strokeWidth = 2.0; // pixels
  var strokeColor = new ol.Color(255, 255, 0, 1);
  batchBuilder.setPolygonStyle(
      color, antiAliasing, strokeWidth, strokeColor);

  // TODO Get polygon geometry data and replace this hard-wired hack
  batchBuilder.polygon([
    ol.renderer.webgl.testData.france(3000, 355242, 5891862)]);
  batchBuilder.polygon([
    ol.renderer.webgl.testData.TRIANGLE,
    ol.renderer.webgl.testData.SQUARE]);
};


/**
 * @param {Array.<ol.StyledLineStringCollection>} lineStrings Line strings.
 */
ol.renderer.webgl.VectorLayer2.prototype.renderLineStrings =
    function(lineStrings) {

  var batchBuilder = this.batchBuilder_;

  // Set style
  // TODO Get style data and replace this hard-wired hack
  var lineWidth = 15.0; // pixels
  var color = new ol.Color(255, 0, 0, 1);
  var strokeWidth = 0.0; // fractional 0..1-eps
  var strokeColor = new ol.Color(255, 255, 0, 1);
  batchBuilder.setLineStyle(
      lineWidth, color, strokeWidth, strokeColor);

  // Draw geometry to batch
  var buf, dim, i, indexBuffer, indices, lineStringCollection;
  for (i = 0; i < lineStrings.length; ++i) {
    lineStringCollection = lineStrings[i].lineStrings;
    buf = lineStringCollection.buf;
    dim = lineStringCollection.dim;
    goog.asserts.assert(dim == 2);
    var inputCoords = /**@type{!Array.<number>}*/(buf.getArray());
    var ends = lineStringCollection.ends;
    for (var offset in ends) {
      var end = ends[offset];
      batchBuilder.lineString(inputCoords, Number(offset), end);
    }
  }
};


/**
 * @param {Array.<ol.geom2.PointCollection>} pointCollections Point collections.
 */
ol.renderer.webgl.VectorLayer2.prototype.renderPointCollections =
    function(pointCollections) {

  var mapRenderer = this.getWebGLMapRenderer();
  var gl = mapRenderer.getGL();

  var fragmentShader = ol.renderer.webgl.vectorlayer2.shader.
      PointCollectionFragment.getInstance();
  var vertexShader = ol.renderer.webgl.vectorlayer2.shader.
      PointCollectionVertex.getInstance();
  var program = mapRenderer.getProgram(fragmentShader, vertexShader);
  gl.useProgram(program);
  if (goog.isNull(this.pointCollectionLocations_)) {
    this.pointCollectionLocations_ =
        new ol.renderer.webgl.vectorlayer2.shader.PointCollection.Locations(
            gl, program);
  }

  gl.uniformMatrix4fv(this.pointCollectionLocations_.u_modelViewMatrix, false,
      this.modelViewMatrix_);
  gl.enableVertexAttribArray(this.pointCollectionLocations_.a_position);

  var buf, dim, i, pointCollection;
  for (i = 0; i < pointCollections.length; ++i) {
    pointCollection = pointCollections[i];
    buf = pointCollection.buf;
    dim = pointCollection.dim;
    mapRenderer.bindBuffer(goog.webgl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(this.pointCollectionLocations_.a_position, 2,
        goog.webgl.FLOAT, false, 4 * dim, 0);
    gl.uniform4fv(this.pointCollectionLocations_.u_color, [1, 0, 0, 0.75]);
    gl.uniform1f(this.pointCollectionLocations_.u_pointSize, 3);
    buf.forEachRange(function(start, stop) {
      gl.drawArrays(goog.webgl.POINTS, start / dim, (stop - start) / dim);
    });
  }

  gl.disableVertexAttribArray(this.pointCollectionLocations_.a_position);

};
