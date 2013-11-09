goog.provide('ol.geom.MultiPolygon');

goog.require('ol.geom.Geometry');



/**
 * @constructor
 * @extends {ol.geom.Geometry}
 * @param {ol.geom.RawMultiPolygon} coordinates Coordinates.
 * @param {ol.geom.Layout=} opt_layout Layout.
 */
ol.geom.MultiPolygon = function(coordinates, opt_layout) {

  goog.base(this);

  /**
   * @type {Array.<Array.<number>>}
   * @private
   */
  this.endss_ = [];

  this.setCoordinates(coordinates, opt_layout);

};
goog.inherits(ol.geom.MultiPolygon, ol.geom.Geometry);


/**
 * @return {ol.geom.RawMultiPolygon} Coordinates.
 */
ol.geom.MultiPolygon.prototype.getCoordinates = function() {
  return ol.geom.inflateCoordinatesss(
      this.flatCoordinates, 0, this.endss_, this.stride);
};


/**
 * @return {Array.<Array.<number>>} Endss.
 */
ol.geom.MultiPolygon.prototype.getEndss = function() {
  return this.endss_;
};


/**
 * @inheritDoc
 */
ol.geom.MultiPolygon.prototype.getType = function() {
  return ol.geom.GeometryType.MULTI_POLYGON;
};


/**
 * @param {ol.geom.RawMultiPolygon} coordinates Coordinates.
 * @param {ol.geom.Layout=} opt_layout Layout.
 */
ol.geom.MultiPolygon.prototype.setCoordinates =
    function(coordinates, opt_layout) {
  this.setLayout(opt_layout, coordinates, 3);
  ol.geom.deflateCoordinatesss(
      this.flatCoordinates, 0, coordinates, this.stride, this.endss_);
  this.dispatchChangeEvent();
};
