goog.provide('ol.cesium');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.object');
goog.require('ol.Object');
goog.require('ol.TileState');
goog.require('ol.layer.LayerProperty');
goog.require('ol.proj');
goog.require('ol.source.State');
goog.require('ol.source.Tile');
goog.require('ol.source.TileImage');
goog.require('ol.tilegrid.XYZ');


/**
 * @param {ol.layer.Tile} tileLayer Tile layer.
 * @return {Cesium.ImageryProvider} ImageryProvider.
 */
ol.cesium.createImageryProvider = function(tileLayer) {

  var tileSource = tileLayer.getSource();
  goog.asserts.assertInstanceof(tileSource, ol.source.TileImage);

  var projection = tileSource.getProjection();

  var tileGrid = tileSource.getTileGrid();
  if (!goog.isDef(tileGrid)) {
    goog.asserts.fail();
    return null;
  }
  goog.asserts.assertInstanceof(tileGrid, ol.tilegrid.XYZ);

  /** @type {Cesium.TilingScheme} */
  var tilingScheme;
  if (tileGrid instanceof ol.tilegrid.XYZ) {
    if (ol.proj.equivalent(projection, ol.proj.get('EPSG:3857'))) {
      tilingScheme = new Cesium.WebMercatorTilingScheme();
    } else if (ol.proj.equivalent(projection, ol.proj.get('EPSG:4326'))) {
      tilingScheme = new Cesium.GeographicTilingScheme();
    } else {
      goog.asserts.fail();
      return null;
    }
  } else {
    goog.asserts.fail();
    return null;
  }

  var errorEvent = new Cesium.Event();

  var imageryProvider = new Cesium.ImageryProvider();
  goog.object.extend(imageryProvider, {
    'getCredit': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return null; // FIXME
    },
    'getErrorEvent': function() {
      return errorEvent;
    },
    'getExtent': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return tilingScheme.getExtent();
    },
    'getLogo': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return undefined;
    },
    'getMaximumLevel': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return tileGrid.getResolutions().length - 1;
    },
    'getMinimumLevel': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return 0;
    },
    'getProxy': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return undefined;
    },
    'getTileDiscardPolicy': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return undefined;
    },
    'getTileHeight': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return tileGrid.getTileSize(0)[1];
    },
    'getTilingScheme': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return tilingScheme;
    },
    'getTileWidth': function() {
      goog.asserts.assert(tileSource.getState() == ol.source.State.READY);
      return tileGrid.getTileSize(0)[0];
    },
    'isReady': function() {
      return tileSource.getState() == ol.source.State.READY;
    },
    'requestImage':
        /**
         * @param {Array.<string>} hostnames Hostnames.
         * @param {number} hostnameIndex Hostname index.
         * @param {number} x X.
         * @param {number} y Y.
         * @param {number} level Level.
         * @return {Cesium.Promise} Promise.
         */
        function(hostnames, hostnameIndex, x, y, level) {
          var tile = tileSource.getTile(level, x, -y - 1, projection);
          goog.asserts.assert(tile.getState() != ol.TileState.EMPTY);
          return Cesium.ImageryProvider.loadImage(
              imageryProvider, tile.getKey());
        }
  });

  goog.events.listen(tileLayer,
      ol.Object.getChangeEventType(ol.layer.LayerProperty.BRIGHTNESS),
      function() {
        imageryProvider.brightness = tileLayer.getBrightness();
      });

  goog.events.listen(tileLayer,
      ol.Object.getChangeEventType(ol.layer.LayerProperty.CONTRAST),
      function() {
        imageryProvider.contrast = tileLayer.getContrast();
      });

  goog.events.listen(tileLayer,
      ol.Object.getChangeEventType(ol.layer.LayerProperty.HUE),
      function() {
        imageryProvider.hue = tileLayer.getHue();
      });

  goog.events.listen(tileLayer,
      ol.Object.getChangeEventType(ol.layer.LayerProperty.SATURATION),
      function() {
        imageryProvider.saturation = tileLayer.getSaturation();
      });

  goog.events.listen(tileLayer,
      ol.Object.getChangeEventType(ol.layer.LayerProperty.OPACITY),
      function() {
        imageryProvider.alpha = tileLayer.getOpacity();
      });

  goog.events.listen(tileLayer,
      ol.Object.getChangeEventType(ol.layer.LayerProperty.VISIBLE),
      function() {
        imageryProvider.show = tileLayer.getVisible();
      });

  return imageryProvider;

};
