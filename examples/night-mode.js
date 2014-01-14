goog.require('ol.Map');
goog.require('ol.RendererHints');
goog.require('ol.View2D');
goog.require('ol.layer.Tile');
goog.require('ol.source.OSM');

var dayLayer = new ol.layer.Tile({
  source: new ol.source.OSM()
});

var ctx = $('<canvas>').get(0).getContext('2d');
var nightLayer = new ol.layer.Tile({
  source: new ol.source.OSM({
    tileLoadFunction: function(imageTile, src) {
      var img = $(imageTile.getImage());
      img.one('load', function() {
        ctx.canvas.width = this.width;
        ctx.canvas.height = this.height;
        ctx.drawImage(this, 0, 0);

        var size = 8, half_size = size / 2;
        var imageData = ctx.getImageData(0, 0, this.width, this.height);
        var i, ii;
        var data = imageData.data;
        for (i = 0, ii = data.length; i < ii; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, 0, 0);
        this.removeAttribute('crossorigin');
        this.src = ctx.canvas.toDataURL();
      });
      img.attr('src', src);
    }
  })
});

var map = new ol.Map({
  layers: [
    nightLayer
  ],
  renderers: ol.RendererHints.createFromQueryData(),
  target: 'map',
  view: new ol.View2D({
    center: [0, 0],
    zoom: 2
  })
});
