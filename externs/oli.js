/**
 * @externs
 */


/**
 * @type {Object}
 */
var oli;



/** @interface */
oli.CollectionEvent = function() {};


/** @type {*} */
oli.CollectionEvent.prototype.element;



/** @interface */
oli.ObjectEvent;


/** @type {string} */
oli.ObjectEvent.prototype.key;



/** @interface */
oli.MapBrowserEvent;


/** @type {goog.events.BrowserEvent} */
oli.MapBrowserEvent.prototype.browserEvent;


/** @type {ol.Coordinate} */
oli.MapBrowserEvent.prototype.coordinate;


/** @type {ol.Pixel} */
oli.MapBrowserEvent.prototype.pixel;



/**
 * @interface
 */
oli.control.Control = function() {};


/**
 * @param {ol.Map} map Map.
 * @return {undefined} Undefined.
 */
oli.control.Control.prototype.setMap = function(map) {};



/** @interface */
oli.interaction.DragAndDropEvent = function() {};


/** @type {Array.<ol.Feature>} */
oli.interaction.DragAndDropEvent.prototype.features;


/** @type {ol.proj.Projection} */
oli.interaction.DragAndDropEvent.prototype.projection;
