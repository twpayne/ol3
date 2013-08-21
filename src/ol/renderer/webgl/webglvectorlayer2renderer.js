goog.provide('ol.renderer.webgl.VectorLayer2');
goog.provide('ol.webglnew.geometry');

goog.require('goog.asserts');
goog.require('goog.vec.Mat4');
goog.require('goog.webgl');
goog.require('ol.math');
goog.require('ol.renderer.webgl.Layer');
goog.require('ol.renderer.webgl.vectorlayer2.shader.LineStringCollection');
goog.require('ol.renderer.webgl.vectorlayer2.shader.PointCollection');
goog.require('ol.structs.Buffer');
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
 * @param {ol.layer.VectorLayer2} vectorLayer2 Vector layer.
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
   * @type
   *     {ol.renderer.webgl.vectorlayer2.shader.LineStringCollection.Locations}
   */
  this.lineStringCollectionLocations_ = null;

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
 * @return {ol.layer.VectorLayer2} Vector layer.
 */
ol.renderer.webgl.VectorLayer2.prototype.getVectorLayer = function() {
  return /** @type {ol.layer.VectorLayer2} */ (this.getLayer());
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
  var lineStrings = vectorSource.getLineStrings();
  if (lineStrings.length > 0) {
    this.renderLineStrings(lineStrings, framebufferDimension);
  }

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
 * @param {Array.<ol.StyledLineStringCollection>} lineStrings Line strings.
 * @param {number} framebufferDimension Framebuffer dimension.
 */
ol.renderer.webgl.VectorLayer2.prototype.renderLineStrings =
    function(lineStrings, framebufferDimension) {

  var mapRenderer = this.getWebGLMapRenderer();
  var gl = mapRenderer.getGL();

  var fragmentShader = ol.renderer.webgl.vectorlayer2.shader.
      LineStringCollectionFragment.getInstance();
  var vertexShader = ol.renderer.webgl.vectorlayer2.shader.
      LineStringCollectionVertex.getInstance();
  var program = mapRenderer.getProgram(fragmentShader, vertexShader);
  gl.useProgram(program);
  if (goog.isNull(this.lineStringCollectionLocations_)) {
    this.lineStringCollectionLocations_ =
        new ol.renderer.webgl.vectorlayer2.shader.LineStringCollection.
            Locations(gl, program);
  }

  var locations = this.lineStringCollectionLocations_;
  var antiAliasing = 1.75, gamma = 2.3;
  gl.uniform3f(locations.RenderParams, antiAliasing, gamma, 1 / gamma);
  gl.uniformMatrix4fv(locations.Transform, false, this.modelViewMatrix_);
  gl.uniform2f(locations.PixelScale,
      2 / framebufferDimension, 2 / framebufferDimension);
  gl.enableVertexAttribArray(locations.PositionP);
  gl.enableVertexAttribArray(locations.Position0);
  gl.enableVertexAttribArray(locations.PositionN);
  gl.enableVertexAttribArray(locations.Control);

  var buf, dim, i, indexBuffer, indices, lineStringCollection;
  for (i = 0; i < lineStrings.length; ++i) {
    lineStringCollection = lineStrings[i].lineStrings;
    buf = lineStringCollection.buf;
    dim = lineStringCollection.dim;
    goog.asserts.assert(dim == 2);
    var vertices = [], inputCoords = buf.getArray();
    var ends = lineStringCollection.ends;
    for (var offset in ends) {
      var end = ends[offset];

      ol.renderer.webgl.VectorLayer2.expandLineString_(
          vertices, inputCoords, Number(offset), end, 2);
    }
    var verticiesBuf = new ol.structs.Buffer(vertices);
    mapRenderer.bindBuffer(goog.webgl.ARRAY_BUFFER, verticiesBuf);
    gl.vertexAttribPointer(
        locations.PositionP, 2, goog.webgl.FLOAT, false, 12, 0);
    gl.vertexAttribPointer(
        locations.Position0, 2, goog.webgl.FLOAT, false, 12, 24);
    gl.vertexAttribPointer(
        locations.PositionN, 2, goog.webgl.FLOAT, false, 12, 48);
    gl.vertexAttribPointer(
        locations.Control, 1, goog.webgl.FLOAT, false, 12, 32);
    var lineWidth = 15.0; // pixels
    var opacity = 255; // 0..255
    var color = ol.renderer.webgl.VectorLayer2.encodeRGB_(1, 0, 0);
    var strokeWidth = 0.0; // fractional 0..1-eps
    var stroke = ol.renderer.webgl.VectorLayer2.encodeRGB_(1, 1, 0);
    gl.vertexAttrib4f(locations.Style, lineWidth, color,
                      Math.floor(opacity) + strokeWidth, stroke);
    gl.drawArrays(goog.webgl.TRIANGLE_STRIP, 0, vertices.length / 3 - 4);
  }

  gl.disableVertexAttribArray(locations.PositionP);
  gl.disableVertexAttribArray(locations.Position0);
  gl.disableVertexAttribArray(locations.PositionN);
  gl.disableVertexAttribArray(locations.Control);

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


/**
 * Encodes an RGB tuple within a sngle float.
 * @param {number} r Red component 0..1.
 * @param {number} g Green component 0..1.
 * @param {number} b Blue component 0..1.
 * @return {number} Encoded color.
 * @private
 */
ol.renderer.webgl.VectorLayer2.encodeRGB_ = function(r, g, b) {
  return Math.floor(r * 255) * 256 +
         Math.floor(g * 255) +
         Math.floor(b * 255) / 256;
};


/**
 * Edge control flags as processed by the vertex shader.
 * @enum {number}
 * @private
 */
ol.renderer.webgl.VectorLayer2.surfaceFlags_ = {
  NOT_AT_EDGE: 0,
  EDGE_LEFT: 1,
  EDGE_RIGHT: 2,
  LAST_INNER: 4,
  LAST_OUTER: 8,
  NO_RENDER: 12
};


/**
 * @param {Array.<number>} dst Destination array for buffer contents.
 * @param {Array.<number>} coords Array of packed input coordinates.
 * @param {number} offset Start index in input array.
 * @param {number} end End index (exclusive).
 * @param {number} nDimensions Number of dimensions per coordinate.
 * @private
 */
ol.renderer.webgl.VectorLayer2.expandLineString_ = function(
    dst, coords, offset, end, nDimensions) {

  var last = end - nDimensions;
  var i, j, e = offset + nDimensions;

  // Assume ring when coordinates of first and last vertex match
  var isRing = true;
  for (i = offset, j = last; i != e; ++i, ++j) {
    if (coords[i] != coords[j]) {
      isRing = false;
      break;
    }
  }
  if (isRing) {
    end -= nDimensions;
    ol.renderer.webgl.VectorLayer2.expandLinearRing_(
        dst, coords, offset, end, nDimensions, nDimensions);
    return;
  }

  // Vertex pattern used for lines:
  // ------------------------------
  //
  // L1  R1   L0  R0   L0  R0   L1  R1
  // ~~~~~~   ======   ------
  //
  // LM  RM   LN  RN   LN  RN   LM  RM
  //          ------   ======   ~~~~~~
  //
  // \________|_________/             <- info visible in the
  //     \________|_________/              shader at specific
  //          \________|_________/         vertices
  //               \________|_________/
  //
  // Legend:
  //     ~ Sentinel vertex
  //     = Terminal vertex, outer
  //     - Terminal vertex, inner
  //     - N: Last index, M: Second last index
  //
  // Terminal vertices:
  //     - one of the two adjacent edges is zero
  //     - sum is the negated actual edge
  //     - 1st nonzero => start of line
  //     - 2nd nonzero => end of line
  //     - difference 1st minus 2nd gives outside direction

  j = offset + nDimensions;
  e = j + nDimensions;
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);

  j = offset;
  e = j + nDimensions;
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_LEFT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_OUTER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_OUTER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_LEFT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_INNER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_INNER);

  for (j = offset + nDimensions; j != last; j = e) {

    e = j + nDimensions;
    for (i = j; i != e; ++i) dst.push(coords[i]);
    dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_LEFT);
    for (i = j; i != e; ++i) dst.push(coords[i]);
    dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT);
  }

  e = j + nDimensions;
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_LEFT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_INNER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_INNER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_LEFT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_OUTER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT |
           ol.renderer.webgl.VectorLayer2.surfaceFlags_.LAST_OUTER);

  j = last - nDimensions;
  e = last;
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);
};


/**
 * @param {Array.<number>} dst Destination array for buffer contents.
 * @param {Array.<number>} coords Array of packed input coordinates.
 * @param {number} offset Start index in input array.
 * @param {number} end End index (exclusive).
 * @param {number} stride Index distance of input coordinates.
 * @param {number} nDimensions Number of dimensions per coordinate.
 * @param {boolean=} opt_forPolygon When set, will use not create a
 *     left edge and not emit a redundant vertex for direct rendering
 *     of triangle strips. Off by default.
 * @private
 */
ol.renderer.webgl.VectorLayer2.expandLinearRing_ = function(
    dst, coords, offset, end, stride, nDimensions, opt_forPolygon) {

  // Won't need a left edge when using CCW winding for the
  // outside contours and CW winding for inside contours of
  // polygons
  var leftEdge = ! opt_forPolygon ?
          ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_LEFT :
          ol.renderer.webgl.VectorLayer2.surfaceFlags_.NOT_AT_EDGE;

  var i, j = end - stride;
  var e = j + nDimensions;

  // Last coord on start sentinel (for proper miters)
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);

  // Line string from coordinates
  for (j = offset; j != end; j += stride) {

    e = j + nDimensions;
    for (i = j; i != e; ++i) dst.push(coords[i]);
    dst.push(leftEdge);
    for (i = j; i != e; ++i) dst.push(coords[i]);
    dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT);
  }

  // Wrap around
  j = offset;
  if (! opt_forPolygon) {
    // Have the wrapped vertex be valid (not a sentinel yet)
    // in order to close the ring when rendering a strip
    e = j + nDimensions;
    for (i = j; i != e; ++i) dst.push(coords[i]);
    dst.push(leftEdge);
    for (i = j; i != e; ++i) dst.push(coords[i]);
    dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.EDGE_RIGHT);
    j += stride;
  }
  // Next (first or second) on end sentinel
  e = j + nDimensions;
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);
  for (i = j; i != e; ++i) dst.push(coords[i]);
  dst.push(ol.renderer.webgl.VectorLayer2.surfaceFlags_.NO_RENDER);

};


