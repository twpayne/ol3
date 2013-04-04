goog.provide('ol.renderer.cesium.SUPPORTED');

goog.require('ol.webgl');


/**
 * @const {boolean} Is supported.
 */
ol.renderer.cesium.isSupported =
    ol.webgl.SUPPORTED && typeof Cesium !== 'undefined';
