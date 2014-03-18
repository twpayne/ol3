goog.provide('ol.source.WFSServer');

goog.require('goog.asserts');
goog.require('goog.net.XhrIo');
goog.require('goog.object');
goog.require('goog.uri.utils');
goog.require('ol.extent');
goog.require('ol.format.WFS');
goog.require('ol.proj');
goog.require('ol.source.ServerVector');



/**
 * @constructor
 * @extends {ol.source.ServerVector}
 * @param {olx.source.WFSServerOptions} options Options.
 */
ol.source.WFSServer = function(options) {

  var format = new ol.format.WFS(options.wfsOptions);
  var method = goog.isDef(options.method) ? options.method : 'get';
  var remoteProjection = ol.proj.get(
      goog.isDef(options.wfsOptions.remoteProjection) ?
      options.wfsOptions.remoteProjection : 'EPSG:4326');
  var url = options.url;
  var wfsWriteGetFeatureOptions = options.wfsWriteGetFeatureOptions;

  /** @type {function(ol.Extent, number, ol.proj.Projection, function(?))} */
  var loadingFunction;
  switch (method) {
    case 'get':
      /** @type {Array.<string>} */
      var typeNamesArray = [];
      var featureTypes = wfsWriteGetFeatureOptions.featureTypes;
      var i, ii;
      for (i = 0, ii = featureTypes.length; i < ii; ++i) {
        typeNamesArray.push(wfsWriteGetFeatureOptions.featureNS + ':' +
            featureTypes[i]);
      }
      var typeNames = typeNamesArray.join(',');
      loadingFunction =
          /**
           * @param {ol.Extent} extent Extent.
           * @param {number} resolution Resolution.
           * @param {ol.proj.Projection} projection Projection.
           * @this {ol.source.WFSServer}
           */
          function(extent, resolution, projection) {
        var transform = ol.proj.getTransform(projection, remoteProjection);
        var remoteExtent = transform(extent, []);
        /** @type {string} */
        var bbox;
        var c = remoteProjection.getAxisOrientation().charAt(0);
        if (c == 'n' || c == 's') {
          bbox = remoteExtent[1] + ',' + remoteExtent[0] + ',' +
              remoteExtent[3] + ',' + remoteExtent[2];
        } else {
          bbox = remoteExtent.join(',');
        }
        var params = {
          'service': 'wfs',
          'version': '1.1.0',
          'request': 'GetFeature',
          'typeNames': typeNames,
          'srsName': remoteProjection.getCode(),
          'bbox': bbox
        };
        var url = goog.uri.utils.appendParamsFromMap(options.url, params);
        window.console.log({url: url});
        goog.net.XhrIo.send(url, this.handleXhrIo);
      };
      break;
    case 'post':
      var xmlSerializer = new XMLSerializer();
      loadingFunction =
          /**
           * @param {ol.Extent} extent Extent.
           * @param {number} resolution Resolution.
           * @param {ol.proj.Projection} projection Projection.
           * @this {ol.source.WFSServer}
           */
          function(extent, resolution, projection) {
        var options = /** @type {olx.format.WFSWriteGetFeatureOptions} */
            (goog.object.clone(wfsWriteGetFeatureOptions));
        options.srid = projection.getCode();
        if (!ol.extent.isInfinite(extent)) {
          options.bbox = extent;
        }
        var node = format.writeGetFeature(options);
        window.console.log({url: url, node: node});
        var content = xmlSerializer.serializeToString(node);
        goog.net.XhrIo.send(url, this.handleXhrIo, method, content);
      };
      break;
    default:
      goog.asserts.fail();
      loadingFunction = goog.nullFunction;
      break;
  }

  goog.base(this, {
    attributions: options.attributions,
    extent: options.extent,
    format: format,
    loadingFunction: loadingFunction,
    loadingStrategy: options.loadingStrategy,
    logo: options.logo,
    projection: options.projection
  });

};
goog.inherits(ol.source.WFSServer, ol.source.ServerVector);
