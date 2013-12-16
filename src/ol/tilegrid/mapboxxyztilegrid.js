goog.provide('ol.tilegrid.MapBoxXYZ');

goog.require('ol.TileCoord');
goog.require('ol.tilegrid.XYZ');



/**
 * @constructor
 * @extends {ol.tilegrid.XYZ}
 * @param {olx.tilegrid.MapBoxXYZOptions} options XYZ options.
 * @struct
 * @todo stability experimental
 */
ol.tilegrid.MapBoxXYZ = function(options) {

  goog.base(this, {
    minZoom: options.minZoom,
    maxZoom: options.maxZoom,
    resolutions: options.resolutions
  });

};
goog.inherits(ol.tilegrid.MapBoxXYZ, ol.tilegrid.XYZ);


/**
 * @inheritDoc
 */
ol.tilegrid.MapBoxXYZ.prototype.getResolution = function(z) {
  return goog.base(this, 'getResolution', z) / 2;
};


/**
 * @inheritDoc
 */
ol.tilegrid.MapBoxXYZ.prototype.getTileRangeForExtentAndResolution =
    function(extent, resolution, opt_tileRange) {
  return goog.base(this, 'getTileRangeForExtentAndResolution',
      extent, 2 * resolution, opt_tileRange);
};
