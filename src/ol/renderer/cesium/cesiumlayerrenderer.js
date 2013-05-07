goog.provide('ol.renderer.cesium.Layer');

goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.TileState');
goog.require('ol.layer.Layer');
goog.require('ol.projection');
goog.require('ol.renderer.Layer');
goog.require('ol.source.ImageTileSource');
goog.require('ol.tilegrid.XYZ');



/**
 * @constructor
 * @extends {ol.renderer.Layer}
 * @param {ol.renderer.cesium.Map} mapRenderer Map renderer.
 * @param {ol.layer.Layer} layer Layer.
 */
ol.renderer.cesium.Layer = function(mapRenderer, layer) {
  goog.base(this, mapRenderer, layer);

  /**
   * @private
   * @type {Cesium.ImageryLayer}
   */
  this.imageryLayer_ = null;

  var source = layer.getSource();
  if (source instanceof ol.source.ImageTileSource) {
    this.imageryLayer_ = ol.renderer.cesium.Layer.createImageryProvider(source);
  } else {
    goog.asserts.assert(false);
  }
};
goog.inherits(ol.renderer.cesium.Layer, ol.renderer.Layer);


/**
 * @param {ol.source.ImageTileSource} source Source.
 * @return {Cesium.ImageryProvider} ImageryProvider.
 */
ol.renderer.cesium.Layer.createImageryProvider = function(source) {

  var projection = source.getProjection();

  var tileGrid = source.getTileGrid();
  if (goog.isDef(tileGrid)) {
    goog.asserts.assert(tileGrid instanceof ol.tilegrid.XYZ);
  } else {
    // FIXME this won't work for Bing or TileJSON
    tileGrid = new ol.tilegrid.XYZ({
      maxZoom: ol.DEFAULT_MAX_ZOOM
    });
  }

  var tilingScheme;
  if (tileGrid instanceof ol.tilegrid.XYZ) {
    if (ol.projection.equivalent(projection, ol.projection.get('EPSG:3857'))) {
      tilingScheme = new Cesium.WebMercatorTilingScheme();
    } else if (ol.projection.equivalent(
        projection, ol.projection.get('EPSG:4326'))) {
      tilingScheme = new Cesium.GeographicTilingScheme();
    } else {
      goog.asserts.assert(false);
    }
  } else {
    goog.asserts.assert(false);
  }

  var errorEvent = new Cesium.Event();

  var imageryProvider = function() {};
  goog.inherits(imageryProvider, Cesium.ImageryProvider);
  goog.object.extend(imageryProvider, {
    'getErrorEvent': function() {
      return errorEvent;
    },
    'getLogo': function() {
      goog.asserts.assert(source.isReady());
      return undefined;
    },
    'getMaximumLevel': function() {
      goog.asserts.assert(source.isReady());
      return tileGrid.getResolutions().length - 1;
    },
    'getTileDiscardPolicy': function() {
      goog.asserts.assert(source.isReady());
      return undefined;
    },
    'getTileHeight': function() {
      goog.asserts.assert(source.isReady());
      return tileGrid.getTileSize(0).height;
    },
    'getTilingScheme': function() {
      goog.asserts.assert(source.isReady());
      return tilingScheme;
    },
    'getTileWidth': function() {
      goog.asserts.assert(source.isReady());
      return tileGrid.getTileSize(0).width;
    },
    'isReady': function() {
      return source.isReady();
    },
    'requestImage':
        /**
         * @param {number} x X.
         * @param {number} y Y.
         * @param {number} level Level.
         * @return {Cesium.Promise} Promise.
         */
        function(x, y, level) {
          var tile = source.getTile(level, x, -y - 1, projection);
          goog.asserts.assert(tile.getState() != ol.TileState.EMPTY);
          return Cesium.ImageryProvider.loadImage(tile.getKey());
        }
  });

  return imageryProvider;

};


/**
 * @return {Cesium.ImageryLayer|undefined} ImageryLayer.
 */
ol.renderer.cesium.Layer.prototype.getImageryLayer = function() {
  return this.imageryLayer_;
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.handleLayerBrightnessChange = function() {
  this.imageryLayer_.brightness = this.getLayer().getBrightness();
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.handleLayerContrastChange = function() {
  this.imageryLayer_.contrast = this.getLayer().getContrast();
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.handleLayerHueChange = function() {
  this.imageryLayer_.hue = this.getLayer().getHue();
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.handleLayerOpacityChange = function() {
  this.imageryLayer_.alpha = this.getLayer().getOpacity();
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.handleLayerSaturationChange = function() {
  this.imageryLayer_.saturation = this.getLayer().getSaturation();
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.handleLayerVisibleChange = function() {
  var layer = this.getLayer();
  this.imageryLayer_.show = layer.getVisible();
  if (layer.isReady()) {
    this.getMap().render();
  }
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Layer.prototype.renderFrame = goog.nullFunction;
