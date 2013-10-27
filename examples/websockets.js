goog.require('goog.net.WebSocket')
goog.require('goog.events.EventHandler')
goog.require('goog.dom')
goog.require('ol.Map');
goog.require('ol.RendererHints');
goog.require('ol.View2D');
goog.require('ol.layer.Tile');
goog.require('ol.source.OSM');


var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  renderers: ol.RendererHints.createFromQueryData(),
  target: 'map',
  view: new ol.View2D({
    center: [0, 0],
    zoom: 2
  })
});

var ws = new goog.net.WebSocket();
ws.open('ws://134.34.14.49:8080/ws');
var eh = new goog.events.EventHandler();
eh.listen(ws, goog.net.WebSocket.EventType.MESSAGE, function(event) {goog.dom.getElement('music').play();}, false, this);



