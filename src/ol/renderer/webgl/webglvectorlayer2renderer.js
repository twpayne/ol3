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


/**
 * @enum {number}
 */
ol.webglnew.geometry = {
  LF_LINE: 0,                 // coordinates represent a line
  LF_RING: 1,                 // coordinates represent a ring
  LF_OUTLINE_INNER: 4,        // outline left (ccw)      V|  |^
  LF_OUTLINE_OUTER: 8,        // outline right (ccw)    |V    ^|
  LF_LINE_OUTLINE_CAPS: 2,    // outline top and bottom
  LF_RING_CLOSED: 3,          // re-emit first vertex pair
  LF_OUTLINE_PROPORTIONAL: 16 // needed w/o derivatives
};


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
 * @param {Array.<number>} coords Coords.
 * @param {boolean=} opt_ring Ring.
 * @param {Array.<number>=} opt_dest Dest.
 * @private
 * @return {Array.<number>} Expanded line.
 */
ol.renderer.webgl.VectorLayer2.expandLine_ = function(
    coords, opt_ring, opt_dest) {

  var flags = (ol.webglnew.geometry.LF_OUTLINE_INNER |
               ol.webglnew.geometry.LF_OUTLINE_OUTER |
               (opt_ring ? ol.webglnew.geometry.LF_RING_CLOSED :
                           ol.webglnew.geometry.LF_LINE_OUTLINE_CAPS));

  //
  var result = opt_dest || [];
  var iLast = coords.length - 2, iFirstSentinel, iLastSentinel;

  var surfInner = 4 - (flags & ol.webglnew.geometry.LF_OUTLINE_INNER ? 4 : 0),
      surfOuter = 4 + (flags & ol.webglnew.geometry.LF_OUTLINE_OUTER ? 4 : 0),
      ctrl;

  if (!(flags & ol.webglnew.geometry.LF_RING)) {
    iFirstSentinel = 0;
    iLastSentinel = iLast;
    ctrl = 1 - (flags & ol.webglnew.geometry.LF_LINE_OUTLINE_CAPS ? 1 : 0);
  } else {
    iFirstSentinel = iLast;
    iLastSentinel = 0;
    ctrl = 1;
  }
  var ctrlLast = 2 - ctrl;

  result.push(coords[iFirstSentinel]);
  result.push(coords[iFirstSentinel + 1]);
  result.push(3);
  result.push(coords[iFirstSentinel]);
  result.push(coords[iFirstSentinel + 1]);
  result.push(3);

  for (var i = 0; i < iLast; i += 2) {

    result.push(coords[i]);
    result.push(coords[i + 1]);
    result.push(ctrl + surfInner);
    result.push(coords[i]);
    result.push(coords[i + 1]);
    result.push(ctrl + surfOuter);

    ctrl = 1;
  }

  result.push(coords[iLast]);
  result.push(coords[iLast + 1]);
  result.push(ctrlLast + surfInner);
  result.push(coords[iLast]);
  result.push(coords[iLast + 1]);
  result.push(ctrlLast + surfOuter);

  if ((flags & ol.webglnew.geometry.LF_RING_CLOSED) ==
      ol.webglnew.geometry.LF_RING_CLOSED) {
    result.push(coords[0]);
    result.push(coords[1]);
    result.push(ctrl + surfInner);
    result.push(coords[0]);
    result.push(coords[1]);
    result.push(ctrl + surfOuter);
    iLastSentinel = 2;
  }

  result.push(coords[iLastSentinel]);
  result.push(coords[iLastSentinel + 1]);
  result.push(3);
  result.push(coords[iLastSentinel]);
  result.push(coords[iLastSentinel + 1]);
  result.push(3);

  return result;
};


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
    var vertices = [];
    var ranges = lineStringCollection.ranges;
    for (var offset in ranges) {
      var end = ranges[offset];
      var coords = buf.getArray().slice(offset, end);
      //window.console.log(coords);
      ol.renderer.webgl.VectorLayer2.expandLine_(coords, false, vertices);
      //window.console.log(vertices);
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
    gl.drawArrays(goog.webgl.TRIANGLES, 0, vertices.length / 3 - 4);
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

  var buf, dim, i, pointCollection;
  for (i = 0; i < pointCollections.length; ++i) {
    pointCollection = pointCollections[i];
    buf = pointCollection.buf;
    dim = pointCollection.dim;
    mapRenderer.bindBuffer(goog.webgl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(this.pointCollectionLocations_.a_position);
    gl.vertexAttribPointer(this.pointCollectionLocations_.a_position, 2,
        goog.webgl.FLOAT, false, 4 * dim, 0);
    gl.uniform4fv(this.pointCollectionLocations_.u_color, [1, 0, 0, 0.75]);
    gl.uniform1f(this.pointCollectionLocations_.u_pointSize, 3);
    buf.forEachRange(function(start, stop) {
      gl.drawArrays(goog.webgl.POINTS, start / dim, (stop - start) / dim);
    });
  }

};
