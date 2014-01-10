goog.provide('ol.source.Element');

goog.require('ol.ElementFunctionType');
goog.require('ol.source.Source');



/**
 * @constructor
 * @extends {ol.source.Source}
 * @param {olx.source.ElementOptions} options Options.
 */
ol.source.Element = function(options) {

  goog.base(this, {
    attributions: options.attributions,
    logo: options.logo,
    projection: options.projection
  });

  /**
   * @private
   * @type {ol.ElementFunctionType}
   */
  this.elementFunction_ = options.elementFunction;

};
goog.inherits(ol.source.Element, ol.source.Source);


/**
 * @param {ol.Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} rotation Rotation.
 * @param {ol.Size} size Size.
 * @param {ol.proj.Projection} projection Projection.
 * @return {Element} Element.
 */
ol.source.Element.prototype.getElement =
    function(center, resolution, rotation, size, projection) {
  return this.elementFunction_(center, resolution, rotation, size, projection);
};
