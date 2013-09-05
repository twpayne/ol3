goog.provide('ol.layer.Image');

goog.require('ol.layer.Layer');
goog.require('ol.source.ImageSource');



/**
 * @constructor
 * @extends {ol.layer.Layer}
 * @param {ol.layer.LayerOptions} options Layer options.
 */
ol.layer.Image = function(options) {
  goog.base(this, options);
};
goog.inherits(ol.layer.Image, ol.layer.Layer);


/**
 * @return {ol.source.ImageSource} Single image source.
 */
ol.layer.Image.prototype.getImageSource = function() {
  return /** @type {ol.source.ImageSource} */ (this.getSource());
};
