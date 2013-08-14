goog.provide('ol.source.VectorSource2');

goog.require('ol.geom2.LineStringCollection');
goog.require('ol.geom2.PointCollection');
goog.require('ol.source.Source');
goog.require('ol.style.LineLiteral');


/**
 * @typedef {{lineStrings: ol.geom2.LineStringCollection,
 *            styles: Array.<ol.style.LineLiteral>}}
 */
ol.StyledLineStringCollection;



/**
 * This is an internal class that will be removed from the API.
 * @constructor
 * @extends {ol.source.Source}
 * @param {ol.source.VectorSource2Options} options Options.
 */
ol.source.VectorSource2 = function(options) {

  goog.base(this, {
    attributions: options.attributions,
    extent: options.extent,
    projection: options.projection
  });

  /**
   * @private
   * @type {Array.<ol.geom2.PointCollection>}
   */
  this.pointCollections_ = goog.isDef(options.pointCollections) ?
      options.pointCollections : [];

  /**
   * @private
   * @type {Array.<ol.StyledLineStringCollection>}
   */
  this.lineStrings_ = goog.isDef(options.lineStrings) ?
      options.lineStrings : [];

};
goog.inherits(ol.source.VectorSource2, ol.source.Source);


/**
 * @return {Array.<ol.StyledLineStringCollection>} Line strings.
 */
ol.source.VectorSource2.prototype.getLineStrings = function() {
  return this.lineStrings_;
};


/**
 * @return {Array.<ol.geom2.PointCollection>} Point collections.
 */
ol.source.VectorSource2.prototype.getPointCollections = function() {
  return this.pointCollections_;
};
