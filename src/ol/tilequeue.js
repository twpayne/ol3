goog.provide('ol.TilePriorityFunction');
goog.provide('ol.TileQueue');

goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.structs.PriorityQueue');
goog.require('ol.Coordinate');
goog.require('ol.Tile');
goog.require('ol.TileState');


/**
 * @typedef {function(ol.Tile, ol.Coordinate, number): (number|undefined)}
 */
ol.TilePriorityFunction;



/**
 * @constructor
 * @param {ol.TilePriorityFunction} tilePriorityFunction
 *     Tile priority function.
 */
ol.TileQueue = function(tilePriorityFunction) {

  /**
   * @private
   * @type {ol.TilePriorityFunction}
   */
  this.tilePriorityFunction_ = tilePriorityFunction;

  /**
   * @private
   * @type {number}
   */
  this.maxTilesLoading_ = 8;

  /**
   * @private
   * @type {number}
   */
  this.tilesLoading_ = 0;

  /**
   * @private
   * @type {goog.structs.PriorityQueue}
   */
  this.queue_ = new goog.structs.PriorityQueue();

  /**
   * @private
   * @type {Object.<string, boolean>}
   */
  this.queuedTileKeys_ = {};

};


/**
 * @param {ol.Tile} tile Tile.
 * @param {ol.Coordinate} tileCenter Tile center.
 * @param {number} tileResolution Tile resolution.
 */
ol.TileQueue.prototype.enqueue =
    function(tile, tileCenter, tileResolution) {
  goog.asserts.assert(tile.getState() == ol.TileState.IDLE);
  var tileKey = tile.getKey();
  if (!(tileKey in this.queuedTileKeys_)) {
    var priority = this.tilePriorityFunction_(tile, tileCenter, tileResolution);
    if (goog.isDef(priority)) {
      this.queue_.enqueue(priority, arguments);
      this.queuedTileKeys_[tileKey] = true;
    } else {
      // FIXME fire drop event?
    }
  }
};


/**
 * @protected
 */
ol.TileQueue.prototype.handleTileChange = function() {
  --this.tilesLoading_;
};


/**
 */
ol.TileQueue.prototype.loadMoreTiles = function() {
  var tile, tileKey;
  while (!this.queue_.isEmpty() && this.tilesLoading_ < this.maxTilesLoading_) {
    tile = (/** @type {Array} */ (this.queue_.remove()))[0];
    tileKey = tile.getKey();
    delete this.queuedTileKeys_[tileKey];
    goog.events.listen(tile, goog.events.EventType.CHANGE,
        this.handleTileChange, false, this);
    tile.load();
    ++this.tilesLoading_;
  }
};


/**
 */
ol.TileQueue.prototype.reprioritize = function() {
  if (!this.queue_.isEmpty()) {
    var queue = this.queue_;
    this.queue_ = new goog.structs.PriorityQueue();
    this.queuedTileKeys_ = {};
    while (!queue.isEmpty()) {
      this.enqueue.apply(this, /** @type {Array} */ (queue.remove()));
    }
  }
};
