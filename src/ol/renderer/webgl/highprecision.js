
goog.provide('ol.renderer.webgl.highPrecision');

goog.require('goog.vec.Mat4');
goog.require('goog.vec.Vec3');


/**
 * Determine a coarse value to encode high precision data in
 * two 32-bit floats.
 * Subtracting this value from the input yields the fine value.
 *
 * @param {number} v High precision floatingpoint value.
 * @return {number} Low precision, coarse part of the input.
 */
ol.renderer.webgl.highPrecision.coarseFloat = function(v) {

  return ol.renderer.webgl.highPrecision.POW2_16_ * (v > 0 ?
      Math.floor(v / ol.renderer.webgl.highPrecision.POW2_16_) :
      Math.ceil(v / ol.renderer.webgl.highPrecision.POW2_16_));
};


/**
 * Extracts and cancels the translation in a matrix transform
 * so that it can be applied as the first step using two 32-bit
 * floats per coordinate component. The sum of the translated
 * coarse and fine positons yields the final coordinate, where
 * the coarse part will more and more cancel out at increasing
 * zoom.
 * @param {!Array.<number>} dstPretranslation Destination array
 *     of coarse and fine coordinate vectors for pretranslation.
 * @param {!Array.<number>} dstMatrix Destination array for
 *     4x4 transformation matrix with removed translation.
 * @param {!Array.<number>} srcMatrix Input 4x4 transformation
 *     matrix.
 */
ol.renderer.webgl.highPrecision.detachTranslation =
    function(dstPretranslation, dstMatrix, srcMatrix) {

  var tmpMatrix = ol.renderer.webgl.highPrecision.tmpMatrix_;
  var tmpVector = ol.renderer.webgl.highPrecision.tmpVector_;

  // Determine translation in world space
  goog.vec.Mat4.invert(srcMatrix, tmpMatrix);
  goog.vec.Mat4.getColumn(tmpMatrix, 3, tmpVector);
  goog.vec.Vec3.negate(tmpVector, tmpVector);
  dstPretranslation[3] = tmpVector[0] - (dstPretranslation[0] =
      ol.renderer.webgl.highPrecision.coarseFloat(tmpVector[0]));
  dstPretranslation[4] = tmpVector[1] - (dstPretranslation[1] =
      ol.renderer.webgl.highPrecision.coarseFloat(tmpVector[1]));
  dstPretranslation[5] = tmpVector[2] - (dstPretranslation[2] =
      ol.renderer.webgl.highPrecision.coarseFloat(tmpVector[2]));

  // Remove translation
  goog.vec.Mat4.makeTranslate(tmpMatrix,
      -srcMatrix[12], -srcMatrix[13], -srcMatrix[14]);
  goog.vec.Mat4.multMat(tmpMatrix, srcMatrix, dstMatrix);
};


/**
 * Sixteenth power of two.
 * @type {number}
 * @const
 * @private
 */
ol.renderer.webgl.highPrecision.POW2_16_ = 65536;


/**
 * Temporary matrix.
 *
 * @type {Array.<number>}
 * @private
 */
ol.renderer.webgl.highPrecision.tmpMatrix_ = new Array(16);


/**
 * Temporary vector.
 *
 * @type {Array.<number>}
 * @private
 */
ol.renderer.webgl.highPrecision.tmpVector_ = new Array(4);
