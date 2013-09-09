goog.provide('ol.renderer.webgl.BatchBuilder');

goog.require('goog.math');
goog.require('libtess');
goog.require('libtess.GluTesselator');
goog.require('ol.Color');
goog.require('ol.renderer.webgl.Batch');
goog.require('ol.renderer.webgl.highPrecision');


// TODO Factor primitive-specific building blocks for batch
// TODO construction into subclasses of 'Render'.
// TODO
// TODO Rationale:
// TODO 1. All control code for a specific primitive type is kept
// TODO    together.
// TODO 2. We have a polymorphic hierarchy here that yields itself
// TODO    well to factorize common code into base classes, e.g.
// TODO    common code for polygons and lines or for different
// TODO    point batching strategies (one style per point vs. one
// TODO    style for many points).
// TODO 3. This file is getting too crowded.



/**
 * Create a BatchBuilder.
 *
 * @constructor
 * @param {!number} maxStraightAngle maxium angle in degrees (0..180)
 *      between adjacent lines in a line string that are joined directly -
 *      sharper joins are beveled or broken.
 * @param {!number} maxBevelAngle maximum angle in degrees (0..180) between
 *      adjacent lines in a line string for which beveled joins are
 *      used - sharper joins are broken.
 */
ol.renderer.webgl.BatchBuilder = function(maxStraightAngle, maxBevelAngle) {

  this.reset_();

  this.tmpVecs_ = [[0, 0, 0], [0, 0], [0, 0]];
  this.styles_ = [[0, 0, 0, 0], [0, 0, 0, 0]];

  maxStraightAngle = goog.math.clamp(maxStraightAngle * 0.5, 0, 90);
  maxBevelAngle = goog.math.clamp(
      maxBevelAngle * 0.5, maxStraightAngle, 90);

  this.cosBevelThld_ = Math.cos(goog.math.toRadians(maxStraightAngle));
  this.cosBreakThld_ = Math.cos(goog.math.toRadians(maxBevelAngle));

  var tess = this.gluTesselator_ = new libtess.GluTesselator();
  tess.gluTessCallback(
      libtess.gluEnum.GLU_TESS_VERTEX_DATA,
      ol.renderer.webgl.BatchBuilder.tessVertexCallback_);
  // A no-op edge flag callback is required to make the tesselator visit
  // triangles only (no strips, no fans)
  tess.gluTessCallback(
      libtess.gluEnum.GLU_TESS_EDGE_FLAG_DATA, goog.nullFunction);
  tess.gluTessCallback(
      libtess.gluEnum.GLU_TESS_ERROR_DATA,
      ol.renderer.webgl.BatchBuilder.tessErrorCallback_);
  // Positive winding materializes (that is CCW in the XY-plane when the
  // Z-axis is sticking out of the screen)
  tess.gluTessProperty(
      libtess.gluEnum.GLU_TESS_WINDING_RULE,
      libtess.windingRule.GLU_TESS_WINDING_POSITIVE);
  tess.gluTessNormal(0, 0, 1);
};


/**
 * Get the resulting batch data from this builder.
 *
 * @return {!ol.renderer.webgl.Batch.Blueprint} All data for rendering
 *     prior to upload to the GPU.
 */
ol.renderer.webgl.BatchBuilder.prototype.releaseBlueprint = function() {
  this.emitDraw_();
  var result = {
    vertexData: new Float32Array(this.vertices_),
    indexData: new Uint16Array(this.indices_),
    controlStream: new Float32Array(this.control_)
  };
  this.reset_();
  return result;
};


/**
 * Sets the style for line rendering.
 *
 * @param {!number} width Width of the line.
 * @param {!ol.Color} color Fill color and alpha.
 * @param {number=} opt_strokeWidth Fractional stroke width.
 * @param {ol.Color=} opt_strokeColor Stroke color (alpha is ignored
 *    instead the opacity specified by the fill color is used).
 */
ol.renderer.webgl.BatchBuilder.prototype.setLineStyle =
    function(width, color, opt_strokeWidth, opt_strokeColor) {

  var /**@type{!number}*/ strokeWidth = (
      goog.math.clamp(opt_strokeWidth || 0, 0, 0.9999)),
      /**@type{!ol.Color}*/ strokeColor = opt_strokeColor || color;

  this.setStyle_(
      ol.renderer.webgl.Batch.ControlStream.RenderType.LINES,
      width * 0.5,
      ol.renderer.webgl.BatchBuilder.encodeRGB_(color),
      Math.floor(color.a * 255) + strokeWidth,
      ol.renderer.webgl.BatchBuilder.encodeRGB_(strokeColor));
};


/**
 * Add a line string to the current batch.
 *
 * The string will be closed (that is, be a ring) if the first and the
 * last coordinate in the range are equal.
 *
 * @param {!Array.<number>} coords Array of packed input coordinates.
 * @param {!number} offset Start index in input array.
 * @param {!number} end End index (exclusive).
 */
ol.renderer.webgl.BatchBuilder.prototype.lineString =
    function(coords, offset, end) {

  this.requestConfig_(
      ol.renderer.webgl.Batch.ControlStream.RenderType.LINES);

  // Vertex pattern used for lines:
  // ------------------------------
  //
  // L1  R1  U1   L0  R0  U0   L0  R0  U0   L1  R1  B1   L2  R2  B2
  // ~~~~~~~~~~   ==========   ----------
  //
  //
  // \____________|_____________/      <-| info visible in the
  //     \____________|_____________/  <-| shader at vertices
  //                                     | (prev, current, next)
  //
  //     [...]    LM  RM  BM   LN  RN  UN   LN  RN  UN   LM  RM  UM
  //                           ----------   ==========   ~~~~~~~~~~
  //                           \____________|_____________/
  //                               \____________|_____________/
  //
  // Legend:
  //     ~ Sentinel vertex (never dereferenced only for lookaside)
  //     = Terminal vertex, outer
  //     - Terminal vertex, inner
  //     - L: Left, R: Right, B: Bevel, U: Unused (lookaside only)
  //     - N: Last index, M: Second last index
  //
  // Terminal vertices:
  //     - one of the two adjacent edges is zero
  //     - sum is the negated actual edge
  //     - 1st nonzero => start of line
  //     - 2nd nonzero => end of line
  //     - difference 1st minus 2nd gives outside direction

  var last = end - 2;

  // Call separate routine for rings (those do not have ends).
  if (coords[offset] == coords[last] &&
      coords[offset + 1] == coords[last + 1]) {

    this.expandLinearRing_(coords, offset, 2, last);
    return;
  }

  var vertices = this.vertices_, indices = this.indices_,
      nextIndex = this.nextVertexIndex_;

  // The first three vertices are used for lookbehind when dereferencing
  // the next vertex, only.
  // In the case of a line we use the second coordinate, so the edge
  // tangent can be determined (the lookahead input gives a redundant
  // first coordinate).

  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[offset + 2], coords[offset + 3],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  // The next two vertices resemble the cap of the line; there is an
  // additional extrusion in tangential direction (along the line)
  // at the caps to allow line smoothing and outlining to happen,
  // as the last segment is artificial and always resembles a
  // straight line with the next segment, only two of three vertices
  // are ever dereferenced.
  // Indexing starts here because of the attribute array offset for
  // the main coordinate

  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[offset], coords[offset + 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_LEFT |
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_RIGHT |
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  // Indexing always happens towards the next (not yet emitted) vertex

  ol.renderer.webgl.BatchBuilder.emitQuadIndices_(
      indices, nextIndex, nextIndex + 1, nextIndex + 3, nextIndex + 4);

  nextIndex += 3;

  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[offset], coords[offset + 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_LEFT,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_RIGHT,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  ol.renderer.webgl.BatchBuilder.emitQuadIndices_(
      indices, nextIndex, nextIndex + 1, nextIndex + 3, nextIndex + 4);

  nextIndex += 3;

  // The special, first vertex and indexing towards the second are in
  // place, here - now create the line junctions until the predecessor
  // of the last

  nextIndex = this.emitLineJunctions_(
      coords, offset + 2, 2, last, offset, last, nextIndex);

  // Now terminal vertices for end of line cap (analog to start of line,
  // see above)

  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[last], coords[last + 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_LEFT,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_RIGHT,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  ol.renderer.webgl.BatchBuilder.emitQuadIndices_(
      indices, nextIndex, nextIndex + 1, nextIndex + 3, nextIndex + 4);

  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[last], coords[last + 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_LEFT |
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_RIGHT |
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  // Sentinel for lookahead when the previous vertex is dereferenced

  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[last - 2], coords[last - 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  // Adjust by 4 triples: Undercounted two (nextIndex points to one
  // before the last connected vertex) + two sentinels (precisely
  // end sentinel offset by size of start sentinel).
  this.nextVertexIndex_ = nextIndex + 12;
};


/**
 * Set the style for polygon rendering.
 *
 * @param {!ol.Color} color Fill color and alpha.
 * @param {!number} antiAliasing Anti-Aliasing width used by the renderer.
 * @param {number=} opt_strokeWidth Stroke width in pixels.
 * @param {ol.Color=} opt_strokeColor Stroke color (alpha is ignored
 *    instead the opacity specified by the fill color is used).
 */
ol.renderer.webgl.BatchBuilder.prototype.setPolygonStyle =
    function(color, antiAliasing, opt_strokeWidth, opt_strokeColor) {

  var extrude,
      outlineWidth,
      strokeColor;
  if (! opt_strokeWidth || ! goog.isDef(opt_strokeColor)) {
    extrude = antiAliasing;
    outlineWidth = 0.0;
    strokeColor = color;
  } else {
    extrude = opt_strokeWidth + antiAliasing * 0.5;
    outlineWidth = (extrude * 0.5 + antiAliasing * 0.5) /
                   (extrude * 0.5 + antiAliasing * 1.5);
    strokeColor = opt_strokeColor;
  }
  this.setStyle_(
      ol.renderer.webgl.Batch.ControlStream.RenderType.POLYGONS,
      extrude,
      ol.renderer.webgl.BatchBuilder.encodeRGB_(color),
      -(Math.floor(color.a * 255) + outlineWidth),
      ol.renderer.webgl.BatchBuilder.encodeRGB_(
          /**@type{!ol.Color}*/(strokeColor)));
};


/**
 * Add a polygon to the current batch.
 *
 * The first contour given defines the outside of the polygon
 * further contours define holes.
 *
 * @param {!Array.<!Array.<!number>>} contours Contours in CCW winding.
 */
ol.renderer.webgl.BatchBuilder.prototype.polygon = function(contours) {

  this.requestConfig_(
      ol.renderer.webgl.Batch.ControlStream.RenderType.POLYGONS);

  var vertices = this.vertices_, indices = this.indices_,
      tess = this.gluTesselator_;

  tess.gluTessBeginPolygon(indices);

  var contour = contours[0],
      startOffset = vertices.length, startIndex = this.nextVertexIndex_;
  this.expandLinearRing_(contour, 0, 2, contour.length);
  this.tesseLeftEdge_(startOffset, startIndex);

  for (var k = 1; k < contours.length; ++k) {
    contour = contours[k];
    startOffset = vertices.length, startIndex = this.nextVertexIndex_;
    this.expandLinearRing_(contour, contour.length - 2, -2, -2);
    this.tesseLeftEdge_(startOffset, startIndex);
  }

  tess.gluTessEndPolygon();
};


// ---------------- Line / polygon rendering details


/**
 * Offsets within vertex layout.
 *
 * @enum {!number}
 * @protected
 */
ol.renderer.webgl.BatchBuilder.Offset = {
  NEXT_VERTEX: 5,
  COORD: 0,
  FLAGS: 4,
  NEXT_TRIPLE: 15,
  COORD_A: 0,
  FLAGS_A: 4,
  COORD_B: 5,
  FLAGS_B: 9,
  COORD_C: 10,
  FLAGS_C: 14,
  FINE_COORD: 2
};


/**
 * Edge control flags as processed by the vertex shader.
 * @enum {!number}
 * @private
 */
ol.renderer.webgl.BatchBuilder.SurfaceFlags_ = {

  // normal extrusion
  NE_IN_EDGE_LEFT: 0,
  NE_VERTEX_INSIDE_LEFT: 1,
  NE_OUT_EDGE_LEFT: 2,
  NE_VERTEX_OUTSIDE_LEFT: 3,
  NE_IN_EDGE_RIGHT: 4,
  NE_VERTEX_INSIDE_RIGHT: 5,
  NE_OUT_EDGE_RIGHT: 6,
  NE_VERTEX_OUTSIDE_RIGHT: 7,

  NE_RIGHT: 4,

  // tangential extrusion
  TE_LINE_END: 8,

  // bypass all displacement
  PASSTHROUGH: 16,
  // Note: Using 'NE_RIGHT' flag in here to omit an extra check
  // when stepping along the left edge for polygon outlines,
  // see 'tesseLeftEdge_'.
  UNREFERENCED: 36
};


/**
 * Scan along the left edge of a line and feed the coordinates to the
 * tesselator, disambiguating redundant vertices.
 *
 * @param {!number} startOffset Vertex buffer start offset.
 * @param {!number} startIndex Index of the first vertex in the buffer.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.tesseLeftEdge_ =
    function(startOffset, startIndex) {

  var vertices = this.vertices_, tess = this.gluTesselator_,
      coord = this.tmpVecs_[0], index, i, e;

  tess.gluTessBeginContour();

  for (i = startOffset +
          ol.renderer.webgl.BatchBuilder.Offset.NEXT_TRIPLE,
       e = vertices.length -
          ol.renderer.webgl.BatchBuilder.Offset.NEXT_TRIPLE,
       index = startIndex; i != e;
       i += ol.renderer.webgl.BatchBuilder.Offset.NEXT_TRIPLE,
       index += 3) {

    // REVISIT: Better to not move vertex when unique?
    // REVISIT: Also add normal displacement?

    if (! (vertices[i + ol.renderer.webgl.BatchBuilder.Offset.FLAGS_C] &
            ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_RIGHT)) {
      // Two left edge vertices in triple

      // Disambiguate redundant coordinates for the tesselator looking
      // at surrounding coordinates (otherwise won't use it)

      ol.renderer.webgl.BatchBuilder.lerpVertexCoord_(coord, vertices,
          i, i - ol.renderer.webgl.BatchBuilder.Offset.NEXT_TRIPLE,
          ol.renderer.webgl.BatchBuilder.EPSILON_DISAMBIG_);
      tess.gluTessVertex(coord, /**@type{?}*/(index));

      ol.renderer.webgl.BatchBuilder.lerpVertexCoord_(coord, vertices,
          i, i + ol.renderer.webgl.BatchBuilder.Offset.NEXT_TRIPLE,
          ol.renderer.webgl.BatchBuilder.EPSILON_DISAMBIG_);
      tess.gluTessVertex(coord, /**@type{?}*/(index + 2));

    } else {
      // One left edge vertex in triple

      coord[0] = vertices[i] + vertices[i +
          ol.renderer.webgl.BatchBuilder.Offset.FINE_COORD];
      coord[1] = vertices[i + 1] + vertices[i + 1 +
          ol.renderer.webgl.BatchBuilder.Offset.FINE_COORD];

      tess.gluTessVertex(coord, /**@type{?}*/(index));

      if (vertices[i + ol.renderer.webgl.BatchBuilder.Offset.FLAGS_A] ==
              ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_LEFT &&
          vertices[i + ol.renderer.webgl.BatchBuilder.Offset.FLAGS_B] ==
              ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_RIGHT) {
        // Broken edge: Skip 5 triples
        // REVISIT: Just skipping here - could consider two vertices.
        i += 5 * ol.renderer.webgl.BatchBuilder.Offset.NEXT_TRIPLE;
        index += 15;
      }
    }
  }

  tess.gluTessEndContour();
};


/**
 * Tiny displacement used to disambiguate redundant vertices for
 * tesselation.
 * @type {!number}
 * @const
 * @private
 */
ol.renderer.webgl.BatchBuilder.EPSILON_DISAMBIG_ = 0.0009765625;


/**
 * Generate vertex data for a linear ring from a range of input
 * coordinates stored in a flat array. A stride can be given that
 * may be negative to adjust the winding on the fly.
 *
 * @param {!Array.<number>} coords Array of packed input coordinates.
 * @param {!number} offset Start index in input array.
 * @param {!number} stride Distance of coordinates in the array.
 * @param {!number} end End index (exclusive).
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.expandLinearRing_ =
    function(coords, offset, stride, end) {

  var vertices = this.vertices_, indices = this.indices_,
      last = end - stride, firstIndex = this.nextVertexIndex_,
      lastIndex;

  // Last coordinate on start sentinel
  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[last], coords[last + 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  // Line string from coordinates, wrap around
  lastIndex = this.emitLineJunctions_(
      coords, offset, stride, last,
      last, last, firstIndex);

  this.emitLineJunctions_(
      coords, last, offset - last, offset,
      last - stride, offset, lastIndex, firstIndex);

  // First coordinate on end sentinel
  ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
      vertices, coords[offset], coords[offset + 1],
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
      ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

  // Adjust by 3 triples: Undercounted one (nextIndex points to the
  // last connected vertex) + two sentinels (precisely end sentinel
  // offset by size of start sentinel).
  this.nextVertexIndex_ = lastIndex + 9;
};


/**
 * Process a range of 2D input coordinates and generate vertices and
 * indices for a partial line string.
 *
 * @param {!Array.<number>} coords Input coordinates.
 * @param {!number} offset Start offset into the input array.
 * @param {!number} stride Distance between adjacent coordinates.
 * @param {!number} end Exclusive end posision in input array.
 * @param {!number} offsetOfPrevious Offset of the coordinate before
 *     the first.
 * @param {!number} offsetOfNext Offset of the coordinate after the
 *     last.
 * @param {!number} index Index of first vertex to be emitted.
 * @param {number=} opt_forceIndex Index used to close rings.
 * @return {!number} The next vertex index unless 'opt_forceIndex'
 *     is given - equal to 'opt_forceIndex' in this case.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.emitLineJunctions_ =
    function(coords, offset, stride, end,
        offsetOfPrevious, offsetOfNext, index, opt_forceIndex) {

  var vertices = this.vertices_, indices = this.indices_,
      i, swapTmp, cosAngle, sinAngle,
      iInL, iInR, flagsA, flagsB, flagsC,
      tgIn = this.tmpVecs_[0], tgOut = this.tmpVecs_[1],
      tgVtx = this.tmpVecs_[2];


  ol.renderer.webgl.BatchBuilder.determineEdgeTangent_(
      tgIn, coords, offsetOfPrevious, offset);

  for (i = offset; i != end; i += stride) {

    // Calculate tangents and derive (co)sine of winding angle

    ol.renderer.webgl.BatchBuilder.determineEdgeTangent_(
        tgOut, coords, i, i + stride);

    ol.renderer.webgl.BatchBuilder.halfwayDirection_(tgVtx, tgIn, tgOut);

    cosAngle = tgIn[0] * tgVtx[0] + tgIn[1] * tgVtx[1];
    sinAngle = tgIn[0] * tgVtx[1] - tgIn[1] * tgVtx[0];

    // Now decide how to handle this junction

    iInL = index;
    iInR = index + 1;
    if (cosAngle >= this.cosBreakThld_) {

      if (cosAngle < this.cosBevelThld_) {
        // Bevel? Build junction triangle and set flags accordingly

        indices.push(iInL);
        indices.push(iInR);
        indices.push(index + 2);

        if (sinAngle > 0) {

          // left turn
          //
          //   E   C
          //         p
          //   D   A   B

          flagsA = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_VERTEX_INSIDE_LEFT;
          flagsB = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_IN_EDGE_RIGHT;
          flagsC = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_RIGHT;

          iInR = index + 2;

        } else {

          // right turn
          //
          //       C   D
          //     p
          //   A   B   E

          flagsA = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_IN_EDGE_LEFT;
          flagsB = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_VERTEX_INSIDE_RIGHT;
          flagsC = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_LEFT;

          iInL = index + 2;
        }

      } else {

        flagsC = ol.renderer.webgl.
            BatchBuilder.SurfaceFlags_.UNREFERENCED;

        if (sinAngle > 0) {

          // classic 2-junction: extrude along vertex normal
          flagsA = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_VERTEX_INSIDE_LEFT;
          flagsB = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_VERTEX_OUTSIDE_RIGHT;

        } else if (sinAngle < 0) {

          // classic 2-junction: extrude along vertex normal
          flagsA = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_VERTEX_OUTSIDE_LEFT;
          flagsB = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_VERTEX_INSIDE_RIGHT;

        } else {

          // Straight line -> either edge normal will do
          flagsA = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_LEFT;
          flagsB = ol.renderer.webgl.
              BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_RIGHT;
        }

      }

    } else {

      // Extremely troublesome? Break the line
      //
      //          bl
      //            \
      //   al      ar
      //   :       :  \
      //   :br     :
      //   :  \    :    \
      //   :       :

      // Note: Using a unique and characteristic flag combination here
      // on the first vertex triple, so we can detect this case when
      // scanning polygon edges, see 'tesseLeftEdge_'
      ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
          vertices, coords[i], coords[i + 1],
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_LEFT,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_RIGHT,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

      ol.renderer.webgl.BatchBuilder.emitQuadIndices_(
          indices, index, index + 1, index + 3, index + 4);

      ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
          vertices, coords[i], coords[i + 1],
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_LEFT |
              ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_RIGHT |
              ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

      var prev = i != offset ? i - stride : offsetOfPrevious;
      ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
          vertices, coords[prev], coords[prev + 1],
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

      var next = i != end - stride ? i + stride : offsetOfNext;
      ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
          vertices, coords[next], coords[next + 1],
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

      ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
          vertices, coords[i], coords[i + 1],
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_LEFT |
              ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_IN_EDGE_RIGHT |
              ol.renderer.webgl.BatchBuilder.SurfaceFlags_.TE_LINE_END,
          ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED);

      ol.renderer.webgl.BatchBuilder.emitQuadIndices_(
          indices, index + 12, index + 13, index + 15, index + 16);

      flagsA = ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_LEFT;
      flagsB = ol.renderer.webgl.BatchBuilder.SurfaceFlags_.NE_OUT_EDGE_RIGHT;
      flagsC = ol.renderer.webgl.BatchBuilder.SurfaceFlags_.UNREFERENCED;

      // Advance - we just emitted 5 extra triples
      iInL = index += 15;
      iInR = index + 1;
    }

    ol.renderer.webgl.BatchBuilder.emitTripleVertex_(
        vertices, coords[i], coords[i + 1], flagsA, flagsB, flagsC);

    index += 3;
    if (goog.isDef(opt_forceIndex)) {
      index = opt_forceIndex;
    }
    ol.renderer.webgl.BatchBuilder.emitQuadIndices_(
        indices, iInL, iInR, index, index + 1);

    // Outgoing tangent of this vertex is incoming tangent of the next
    // swap to reuse memory
    swapTmp = tgIn;
    tgIn = tgOut;
    tgOut = swapTmp;
  }

  return index;
};


// ---------------- Geometry factorizations


/**
 * Determine the (normalized) edge tangent between two vectors in
 * a coordinate array.
 *
 * @param {!Array.<number>} dst Destination array.
 * @param {!Array.<number>} coords Flat array of input coordinates.
 * @param {!number} iFrom Index of first vector.
 * @param {!number} iTo Index of second vector.
 * @private
 */
ol.renderer.webgl.BatchBuilder.determineEdgeTangent_ =
    function(dst, coords, iFrom, iTo) {

  var x = coords[iTo] - coords[iFrom];
  var y = coords[iTo + 1] - coords[iFrom + 1];
  var f = 1 / Math.sqrt(x * x + y * y);
  dst[0] = x * f;
  dst[1] = y * f;
};


/**
 * Linearly interpolate two vertex coordinate vectors.
 *
 * @param {!Array.<number>} dst Destination array.
 * @param {!Array.<number>} vertices Flat array of input coordinates.
 * @param {!number} offsFirst Index offset of first coordinate vector.
 * @param {!number} offsSecond Index offset of second coordinate vector.
 * @param {!number} x Interpolation parameter.
 * @private
 */
ol.renderer.webgl.BatchBuilder.lerpVertexCoord_ =
    function(dst, vertices, offsFirst, offsSecond, x) {

  dst[0] = goog.math.lerp(
      vertices[offsFirst] + vertices[offsFirst +
          ol.renderer.webgl.BatchBuilder.Offset.FINE_COORD],
      vertices[offsSecond] + vertices[offsSecond +
          ol.renderer.webgl.BatchBuilder.Offset.FINE_COORD],
      x);
  dst[1] = goog.math.lerp(
      vertices[offsFirst + 1] + vertices[offsFirst + 1 +
          ol.renderer.webgl.BatchBuilder.Offset.FINE_COORD],
      vertices[offsSecond + 1] + vertices[offsSecond + 1 +
          ol.renderer.webgl.BatchBuilder.Offset.FINE_COORD],
      x);
};


/**
 * Determine the two-dimensional normal halfway vector between two
 * two-dimensional normal input vectors.
 *
 * @param {!Array.<number>} dst Destination array.
 * @param {!Array.<number>} a Array holding the first vector.
 * @param {!Array.<number>} b Array holding the second vector.
 * @private
 */
ol.renderer.webgl.BatchBuilder.halfwayDirection_ = function(dst, a, b) {

  var x = a[0] + b[0];
  var y = a[1] + b[1];
  var f = 1 / Math.sqrt(x * x + y * y);
  dst[0] = x * f;
  dst[1] = y * f;
};


// ---------------- Encoding factorizations


/**
 * Emit three vertices with redundant coordinates distinguished by
 * their control flags.
 *
 * @param {!Array.<number>} vertices Destination array.
 * @param {!number} x X-component of coordinate.
 * @param {!number} y Y-component of coordinate.
 * @param {!number} flagsA Flags for first vertex in triple.
 * @param {!number} flagsB Flags for second vertex in triple.
 * @param {!number} flagsC Flags for third vertex in triple.
 * @private
 */
ol.renderer.webgl.BatchBuilder.emitTripleVertex_ =
    function(vertices, x, y, flagsA, flagsB, flagsC) {

  var xCoarse = ol.renderer.webgl.highPrecision.coarseFloat(x),
      yCoarse = ol.renderer.webgl.highPrecision.coarseFloat(y);

  vertices.push(xCoarse);
  vertices.push(yCoarse);
  vertices.push(x -= xCoarse);
  vertices.push(y -= yCoarse);
  vertices.push(flagsA);
  vertices.push(xCoarse);
  vertices.push(yCoarse);
  vertices.push(x);
  vertices.push(y);
  vertices.push(flagsB);
  vertices.push(xCoarse);
  vertices.push(yCoarse);
  vertices.push(x);
  vertices.push(y);
  vertices.push(flagsC);
};


/**
 * Emit triangle indexes for a quad.
 *
 * @param {!Array.<number>} indices Destination array to append to.
 * @param {!number} iInL Incoming "left edge" index.
 * @param {!number} iInR Incoming "right edge" index.
 * @param {!number} iOutL Outgoing "left edge" index.
 * @param {!number} iOutR Outgoing "right edge" index.
 * @private
 */
ol.renderer.webgl.BatchBuilder.emitQuadIndices_ =
    function(indices, iInL, iInR, iOutL, iOutR) {

  indices.push(iInL);
  indices.push(iInR);
  indices.push(iOutL);
  indices.push(iInR);
  indices.push(iOutR);
  indices.push(iOutL);
};


/**
 * Encode a color (without alpha) in a floatingpoint value.
 *
 * @param {!ol.Color} color Color to encode.
 * @return {!number} Encoded red, green and blue component (8 bit each).
 * @private
 */
ol.renderer.webgl.BatchBuilder.encodeRGB_ = function(color) {
  return (
      Math.floor(color.r) * 256 +
      Math.floor(color.g) +
      Math.floor(color.b) / 256);
};


// ---------------- GluTesselator callbacks


/**
 * Record indexes from the tesselator.
 *
 * @param {!number} index - Vertex index (second argument to gluTessVertex).
 * @param {!Array.<number>} indices - Destination array for vertex indices.
 * @private
 */
ol.renderer.webgl.BatchBuilder.tessVertexCallback_ = function(index, indices) {
  // Data element is the index, record it
  indices.push(index);
};


/**
 * Log errors from the tesselator.
 *
 * @param {!Number} errno Error number.
 * @private
 */
ol.renderer.webgl.BatchBuilder.tessErrorCallback_ = function(errno) {

  var name = '';
  if (! goog.DEBUG) {
    // Only attempt to find symbol in debug mode.

    for (var key in libtess.errorType) {
      if (libtess.errorType[key] == errno) {
        name = key;
        break;
      }
    }
    if (! name) {
      // Not found yet? See whether we got a generic GLU error
      for (var key in {GLU_INVALID_ENUM: 1, GLU_INVALID_VALUE: 1}) {
        if (libtess.gluEnum[key] == errno) {
          name = key;
          break;
        }
      }
    }
  }
  // TODO Use some logging facility?
  throw 'libtess.GluTesselator error #' + errno + ' ' + name;
};


// ---------------- Batching infrastructure


/**
 * Initialize the internal state for a new batch.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.reset_ = function() {

  /**
   * Control stream data.
   * @type {!ol.renderer.webgl.Batch.ControlStream}
   * @private
   */
  this.control_ = [];

  /**
   * Index data.
   * @type {!Array.<number>}
   * @private
   */
  this.indices_ = [];

  /**
   * Vertex data.
   * @type {!Array.<number>}
   * @private
   */
  this.vertices_ = [];

  /**
   * Vertex buffer is bound at this offset.
   * @type {number}
   * @private
   */
  this.vertexBufferOffset_ = 0;

  /**
   * Next vertex index (== number of vertices emitted since the
   * point in the control stream where the vertex buffer offset
   * has been set).
   * @type {!number}
   * @private
   */
  this.nextVertexIndex_ = 0;

  /**
   * Indices covered by draw calls emitted to the control stream.
   * @type {!number}
   * @private
   */
  this.nIndicesFlushed_ = 0;

  /**
   * Configuration set at current position of the control stream.
   * @type {?number}
   * @private
   */
  this.currentRender_ = null;
};


/**
 * Ensure a specific render is activated at the current position in
 * the control stream.
 *
 * @param {!ol.renderer.webgl.Batch.ControlStream.RenderType} render
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.requestConfig_ =
    function(render) {

  if (render == this.currentRender_) {
    // Already active? Nothing to do.
    return;
  }

  // Remap vertex buffer to new offset, restart index counting
  this.vertexBufferOffset_ = this.vertices_.length;
  this.nextVertexIndex_ = 0;

  // Emit control instructions for reconfiguration and do so with style
  this.currentRender_ = render;
  this.emitConfigure_();
  this.emitSetStyle_();
};


/**
 * Request a style vector to be set for a specific configuration.
 *
 * @param {!number} render Index of renderer configuration.
 * @param {!number} s First component of style vector.
 * @param {!number} t Second component of style vector.
 * @param {!number} p Third component of style vector.
 * @param {!number} q Fourth component of style vector.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.setStyle_ =
    function(render, s, t, p, q) {

  var style = this.styles_[render];
  if (style[0] != s || style[1] != t || style[2] != p || style[3] != q) {
    // Style has really changed?
    style[0] = s, style[1] = t, style[2] = p, style[3] = q;
    if (render == this.currentRender_) {
      // Set style when render configured - otherwise gets set later
      // when switching to this geometry
      this.emitSetStyle_();
    }
  }
};


// ---------------- Batching infrastructure details


/**
 * Emit a DRAW_ELEMENTS instruction to the control stream.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.emitDraw_ = function() {

  var n = this.indices_.length - this.nIndicesFlushed_;
  if (n > 0) {
    // Any new indices? Have them drawn at this point
    this.control_.push(
        ol.renderer.webgl.Batch.ControlStream.Instruction.DRAW_ELEMENTS);
    this.control_.push(n);
    this.nIndicesFlushed_ = this.indices_.length;
  }
};


/**
 * Emit a SET_STYLE instruction to the control stream.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.emitSetStyle_ =
    function() {

  // Ensure everything is rendered until here
  this.emitDraw_();

  // Write instruction and style quadruple to control stream
  var style = this.styles_[this.currentRender_];
  this.control_.push(
      ol.renderer.webgl.Batch.ControlStream.Instruction.SET_STYLE);
  this.control_.push(style[0]);
  this.control_.push(style[1]);
  this.control_.push(style[2]);
  this.control_.push(style[3]);
};


/**
 * Emit a CONFIGURE instruction to the control stream.
 * @private
 */
ol.renderer.webgl.BatchBuilder.prototype.emitConfigure_ =
    function() {

  // Ensure everything is rendered until here
  this.emitDraw_();

  // Write instruction, configuration index and vertex buffer
  // offset (in bytes) to the control stream
  this.control_.push(
      ol.renderer.webgl.Batch.ControlStream.Instruction.CONFIGURE);
  this.control_.push(this.currentRender_);
  this.control_.push(this.vertexBufferOffset_ * 4);
};
