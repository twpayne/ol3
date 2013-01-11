// FIXME re-enable rotation when supported

goog.provide('ol.renderer.dom.Map');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.functions');
goog.require('ol.Coordinate');
goog.require('ol.FrameState');
goog.require('ol.layer.TileLayer');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.dom.TileLayer');



/**
 * @constructor
 * @extends {ol.renderer.Map}
 * @param {Element} container Container.
 * @param {ol.Map} map Map.
 */
ol.renderer.dom.Map = function(container, map) {

  goog.base(this, container, map);

  /**
   * @type {!Element}
   * @private
   */
  this.layersPane_ = goog.dom.createElement(goog.dom.TagName.DIV);
  this.layersPane_.className = 'ol-layers-pane ol-unselectable';
  var style = this.layersPane_.style;
  style.position = 'absolute';
  style.width = '100%';
  style.height = '100%';

  goog.dom.insertChildAt(container, this.layersPane_, 0);

};
goog.inherits(ol.renderer.dom.Map, ol.renderer.Map);


/**
 * @inheritDoc
 */
ol.renderer.dom.Map.prototype.canRotate = goog.functions.TRUE;


/**
 * @inheritDoc
 */
ol.renderer.dom.Map.prototype.createLayerRenderer = function(layer) {
  if (layer instanceof ol.layer.TileLayer) {
    var layerRenderer = new ol.renderer.dom.TileLayer(this, layer);
    goog.dom.appendChild(this.layersPane_, layerRenderer.getTarget());
    return layerRenderer;
  } else {
    goog.asserts.assert(false);
    return null;
  }
};


/**
 * @inheritDoc
 */
ol.renderer.dom.Map.prototype.handleViewPropertyChanged = function() {
  goog.base(this, 'handleViewPropertyChanged');
  this.getMap().render();
};


/**
 * @inheritDoc
 */
ol.renderer.dom.Map.prototype.handleSizeChanged = function() {
  goog.base(this, 'handleSizeChanged');
  this.getMap().render();
};


/**
 * @inheritDoc
 */
ol.renderer.dom.Map.prototype.handleViewChanged = function() {
  goog.base(this, 'handleViewChanged');
  this.getMap().render();
};


/**
 * @inheritDoc
 */
ol.renderer.dom.Map.prototype.renderFrame = function(frameState) {

  if (goog.isNull(frameState)) {
    // FIXME remove everything
    return;
  }

  goog.array.forEach(frameState.layersArray, function(layer) {
    var layerState = frameState.layerStates[goog.getUid(layer)];
    if (!layerState.ready) {
      return;
    }
    var layerRenderer = this.getLayerRenderer(layer);
    layerRenderer.renderFrame(frameState, layerState);
  }, this);

};
