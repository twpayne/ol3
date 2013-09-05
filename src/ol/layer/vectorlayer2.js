goog.provide('ol.layer.Vector2');

goog.require('ol.layer.Layer');
goog.require('ol.source.VectorSource2');



/**
 * This is an internal class that will be removed from the API.
 * @constructor
 * @extends {ol.layer.Layer}
 * @param {ol.layer.LayerOptions} options Options.
 */
ol.layer.Vector2 = function(options) {
  goog.base(this, options);
};
goog.inherits(ol.layer.Vector2, ol.layer.Layer);


/**
 * @return {ol.source.VectorSource2} Source.
 */
ol.layer.Vector2.prototype.getVectorSource = function() {
  return /** @type {ol.source.VectorSource2} */ (this.getSource());
};
