// FIXME offset panning

goog.provide('ol.renderer.canvas.Map');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.style');
goog.require('ol.Size');
goog.require('ol.css');
goog.require('ol.layer.Image');
goog.require('ol.layer.Tile');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.canvas.ImageLayer');
goog.require('ol.renderer.canvas.TileLayer');
goog.require('ol.size');
goog.require('ol.source.State');



/**
 * @constructor
 * @extends {ol.renderer.Map}
 * @param {Element} container Container.
 * @param {ol.Map} map Map.
 */
ol.renderer.canvas.Map = function(container, map) {

  goog.base(this, container, map);

  /**
   * @private
   * @type {Element}
   */
  this.canvas_ = goog.dom.createElement(goog.dom.TagName.CANVAS);
  this.canvas_.height = container.clientHeight;
  this.canvas_.width = container.clientWidth;
  this.canvas_.className = ol.css.CLASS_UNSELECTABLE;
  goog.dom.insertChildAt(container, this.canvas_, 0);

  /**
   * @private
   * @type {boolean}
   */
  this.renderedVisible_ = true;

  /**
   * @private
   * @type {ol.Size}
   */
  this.canvasSize_ = [container.clientHeight, container.clientWidth];

  /**
   * @private
   * @type {CanvasRenderingContext2D}
   */
  this.context_ = this.canvas_.getContext('2d');

};
goog.inherits(ol.renderer.canvas.Map, ol.renderer.Map);


/**
 * @inheritDoc
 */
ol.renderer.canvas.Map.prototype.createLayerRenderer = function(layer) {
  if (layer instanceof ol.layer.Image) {
    return new ol.renderer.canvas.ImageLayer(this, layer);
  } else if (layer instanceof ol.layer.Tile) {
    return new ol.renderer.canvas.TileLayer(this, layer);
  } else {
    goog.asserts.fail();
    return null;
  }
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.Map.prototype.getCanvas = function() {
  return this.canvas_;
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.Map.prototype.renderFrame = function(frameState) {

  if (goog.isNull(frameState)) {
    if (this.renderedVisible_) {
      goog.style.setElementShown(this.canvas_, false);
      this.renderedVisible_ = false;
    }
    return;
  }

  var size = frameState.size;
  if (!ol.size.equals(this.canvasSize_, size)) {
    this.canvas_.width = size[0];
    this.canvas_.height = size[1];
    this.canvasSize_ = size;
  }

  var context = this.context_;
  context.clearRect(0, 0, size[0], size[1]);

  this.calculateMatrices2D(frameState);

  var layerStates = frameState.layerStates;
  var layersArray = frameState.layersArray;
  var viewResolution = frameState.view2DState.resolution;
  var i, ii, layer, layerRenderer, layerState;
  for (i = 0, ii = layersArray.length; i < ii; ++i) {
    layer = layersArray[i];
    layerRenderer = this.getLayerRenderer(layer);
    layerState = layerStates[goog.getUid(layer)];
    if (!layerState.visible ||
        layerState.sourceState != ol.source.State.READY ||
        viewResolution >= layerState.maxResolution ||
        viewResolution < layerState.minResolution) {
      continue;
    }
    layerRenderer.prepareFrame(frameState, layerState);
    layerRenderer.composeFrame(frameState, layerState, context);
  }

  if (!this.renderedVisible_) {
    goog.style.setElementShown(this.canvas_, true);
    this.renderedVisible_ = true;
  }

  this.scheduleRemoveUnusedLayerRenderers(frameState);

};
