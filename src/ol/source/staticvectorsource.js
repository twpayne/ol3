goog.provide('ol.source.StaticVector');

goog.require('ol.source.FormatVector');
goog.require('ol.source.State');



/**
 * @constructor
 * @extends {ol.source.FormatVector}
 * @param {olx.source.StaticVectorOptions} options Options.
 * @todo stability experimental
 */
ol.source.StaticVector = function(options) {

  goog.base(this, {
    attributions: options.attributions,
    extent: options.extent,
    format: options.format,
    logo: options.logo,
    projection: options.projection
  });

  if (goog.isDef(options.arrayBuffer)) {
    this.readFeatures(options.arrayBuffer);
  }

  if (goog.isDef(options.doc)) {
    this.readFeatures(options.doc);
  }

  if (goog.isDef(options.node)) {
    this.readFeatures(options.node);
  }

  if (goog.isDef(options.object)) {
    this.readFeatures(options.object);
  }

  if (goog.isDef(options.text)) {
    this.readFeatures(options.text);
  }

  if (goog.isDef(options.url) || goog.isDef(options.urls)) {
    this.setState(ol.source.State.LOADING);
    if (goog.isDef(options.url)) {
      this.loadFeaturesFromURL(options.url);
    }
    if (goog.isDef(options.urls)) {
      var urls = options.urls;
      var i, ii;
      for (i = 0, ii = urls.length; i < ii; ++i) {
        this.loadFeaturesFromURL(urls[i]);
      }
    }
  }

};
goog.inherits(ol.source.StaticVector, ol.source.FormatVector);
