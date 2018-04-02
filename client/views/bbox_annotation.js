import React from 'react';
import $ from 'jquery';
import 'bootstrap';

import L from 'leaflet';
import '../leaflet.draw/leaflet.draw-src.js';

import {COLORS,KEYS} from '../utils.js';
import {Annotation} from './annotation.js';
import {BBoxInstructions} from './instructions.js';


class BBoxInstance extends React.Component {

  constructor(props) {
      super(props);

      //this.keypointVisibilityChanged = this.keypointVisibilityChanged.bind(this);
      this.deleteRequested = this.deleteRequested.bind(this);

      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.onFocus = this.onFocus.bind(this);
      //this.onAnnotateNA = this.onAnnotateNA.bind(this);
      this.onHideOthers = this.onHideOthers.bind(this);
  }

  deleteRequested(){
    this.props.handleDelete(this.props.id);
  }

  onMouseEnter(){

  }

  onMouseLeave(){

  }

  onFocus(){
    this.props.handleFocus(this.props.id);
  }

  onHideOthers(){
    this.props.handleHideOthers(this.props.id);
  }

  render(){

    let annotation_color = COLORS[this.props.id % COLORS.length];

    // Are we hidden?
    var hiddenBadge = "";
    if(this.props.hidden){
      hiddenBadge = <span className="badge badge-secondary mr-1">Hidden</span>;
    }
    //<span className="badge mr-1" style={{backgroundColor: annotation_color}}>&#9634;</span>
    return (
      <div className="card">
        <div role="tab" id={"annotationHeader" + this.props.id}
             onMouseEnter={this.onMouseEnter}
             onMouseLeave={this.onMouseLeave}>
          <div className="d-flex justify-content-between">
            <div className="p-2">
              <span className="badge px-2 mr-1" style={{backgroundColor: annotation_color}}></span>
              <span>{this.props.category.name}</span>
            </div>
            <div className="p-2">
              {hiddenBadge}
              <button type="button" className="btn btn-sm btn-danger" onClick={this.deleteRequested}>Delete</button>
            </div>
          </div>
        </div>
      </div>
    );

  }

}

export class BBoxAnnotation extends React.Component {

    // Create the leaflet map and render the image

    constructor(props) {
        super(props);

        this.state = {
            annotations : this.props.annotations, // Current state of the annotations
            annotating : false // Are we currently anntating something?
        };

        // This will hold the leaflet layers that correspond to the annotations stored in `this.state.annotations`
        // It is a mirror of this.state.annotations
        this.annotation_layers = null;

        // Properties used to track annotation status
        this._drawSuccessfullyCreated = null; // used to determine if the user actually made an annotation or simply clicked on the image
        this._currentDrawer = null; // the current drawer used for making the annotation
        this.annotating_keypoint = null; // Are we annotating a keypoint?
        this.annotating_bbox = null; // Are we annotating a bbox?
        this.current_annotationIndex = null; // Which annotation are we modifing? This indexes into this.state.annotations
        this.current_keypointIndex = null; // Which keypoint are we annotating? This indexes into this.state.annotations[<i>].keypoints
        this.new_category_id = null; // If we are creating a new instance, then which category does it belong to?

        // Used when creating a new instance and we want to annotate all of the keypoints
        this.annotate_keypoints_for_new_instances = true; // When we create a new instance, should we annotate all of the keypoints automatically?
        this.annotation_keypoint_queue = []; // A queue of keypoints to annotate.

        // create a map from category id to category info, this is for convenience
        this.categoryMap = {};
        for(var i = 0; i < this.props.categories.length; i++){
          var category = this.props.categories[i]
          this.categoryMap[category['id']] = category;
        }

        // BBox cross hair div elements:
        this.bbox_crosshairs = null;

        //this.handleKeypointVisibilityChange = this.handleKeypointVisibilityChange.bind(this);
        this.createNewInstance = this.createNewInstance.bind(this);
        this.cancelBBoxAnnotation = this.cancelBBoxAnnotation.bind(this);
        this.handleAnnotationDelete = this.handleAnnotationDelete.bind(this);
        this.handleSave = this.handleSave.bind(this);
        //this.checkKeypointAnnotationQueue = this.checkKeypointAnnotationQueue.bind(this);
        this.handleAnnotationFocus = this.handleAnnotationFocus.bind(this);
        //this.handleAnnotateKeypoints = this.handleAnnotateKeypoints.bind(this);
        this.hideOtherAnnotations = this.hideOtherAnnotations.bind(this);
        this.hideAllAnnotations = this.hideAllAnnotations.bind(this);
        this.showAllAnnotations = this.showAllAnnotations.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        this.bboxCursorUpdate = this.bboxCursorUpdate.bind(this);

    }

    // Add the image overlay and render the annotations.
    componentDidMount() {

      // Create the leaflet map
      this.leafletMap = L.map(this.leafletHolderEl, {
        center : [0, 0],
        zoom : 0,
        crs: L.CRS.Simple,
        zoomControl : true,
        maxBoundsViscosity : 0.5,
        drawControlTooltips : false
      });
      const leafletMap = this.leafletMap;

      // Determine the resolution that the image will be rendered at
      let pixel_bounds = leafletMap.getPixelBounds();
      let maxWidth = pixel_bounds.max.x - pixel_bounds.min.x;
      let maxHeight = pixel_bounds.max.y - pixel_bounds.min.y;

      let imageWidth = this.props.imageElement.width;
      let imageHeight = this.props.imageElement.height;

      let ratio = [maxWidth / imageWidth, maxHeight / imageHeight ];
      ratio = Math.min(ratio[0], ratio[1]);

      let height = ratio * imageHeight;
      let width = ratio * imageWidth;

      // Save off the resolution of the image, we'll need this
      // for scaling the normalized annotations
      this.imageWidth = width;
      this.imageHeight = height;

      // Restrict the map to the image bounds
      let southWest = leafletMap.unproject([0, height], leafletMap.getMinZoom());
      let northEast = leafletMap.unproject([width, 0], leafletMap.getMinZoom());
      let bounds = new L.LatLngBounds(southWest, northEast);
      // GVH: The order of these calls matter!
      leafletMap.fitBounds(bounds);
      leafletMap.setMaxBounds(bounds);

      // Render the image on the map
      let image = L.imageOverlay(this.props.imageElement.src, bounds).addTo(leafletMap);

      // Add the feature group that will hold the annotations
      // All layers added to this feature group will be editable
      this.annotationFeatures = new L.FeatureGroup().addTo(leafletMap);

      // Initialize the editor
      this.editor = new L.EditToolbar.Edit(leafletMap, {featureGroup : this.annotationFeatures});

      // set up the event listeners
      // Drawing / Editing / Deleting Events
      leafletMap.on('draw:drawstart', this._drawStartEvent, this);
      leafletMap.on('draw:drawstop', this._drawStopEvent, this);
      leafletMap.on('draw:created', this._drawCreatedEvent, this);
      leafletMap.on('draw:editmove', this._layerMoved, this);
      leafletMap.on('draw:editresize', this._layerResized, this);

      leafletMap.on('draw:drawvertex', this._vertexDrawn, this);


      // We'll use this list to mirror the json annotations
      this.annotation_layers = [];
      // Add the annotations
      for(var i=0; i < this.state.annotations.length; i++){
        this.annotation_layers.push(this.addAnnotation(this.state.annotations[i], i));
      }

      // Register keypresses
      document.addEventListener("keydown", this.handleKeyDown);


      if (this.props.startNewInstance){
        // Have the user add a new instance
        this.createNewInstance();
      }
      else if (this.props.enableEditing){
        // Let the user edit boxes
        this.enableEditing();
      }

    }

    componentWillUnmount(){
      // Unregister keypresses
      document.removeEventListener("keydown", this.handleKeyDown);
    }

    handleKeyDown(e){

      switch(e.keyCode){
        case KEYS.ESCAPE:
          if(this.state.annotating){

            // Clear the annotation keypoint queue
            this.annotation_keypoint_queue = [];

            if(this.annotating_keypoint){
              this.cancelKeypointAnnotation();
            }
            else if(this.annotating_bbox){
              this.cancelBBoxAnnotation();
            }

          }
          break;

        case KEYS.D:
          this.createNewInstance();
          break;
        case KEYS.H:
          this.hideAllAnnotations();
          break;
        case KEYS.S:
          this.showAllAnnotations();
          break;
      }

    }

    createBBoxPathStyle(color) {
      return {
        'stroke' : true,
        'color' : color,
        'weight' : 4,
        'opacity' : 1,
        'fill' : false,
        'fillColor' : color,
        'fillOpacity' : 0.2
      }
    }

    /**
     * Add an annotation to the image. This will render the bbox and keypoint annotations.
     * @param {*} annotation
     * @param {*} annotationIndex
     */
    addAnnotation(annotation, annotationIndex) {

      let imageWidth = this.imageWidth;
      let imageHeight = this.imageHeight;

      // Get the category for this instance, we need to access the keypoint information
      var category = null;
      if(annotation['category_id'] != 'undefined'){
        category = this.categoryMap[annotation['category_id']];
      }

      // Store the layers for this annotation
      var layers = {
        'bbox' : null,
        'keypoints' : null,
      };

      // Add the bounding box
      if(annotation.bbox != 'undefined' && annotation.bbox != null){

        let color = COLORS[annotationIndex % COLORS.length];
        let pathStyle = this.createBBoxPathStyle(color)

        var [x1, y1, w, h] = annotation.bbox;
        x1 = x1 * imageWidth;
        y1 = y1 * imageHeight;
        let x2 = x1 + w * imageWidth;
        let y2 = y2 + h * imageHeight;
        let bounds = L.latLngBounds(this.leafletMap.unproject([x1, y1], 0), this.leafletMap.unproject([x2, y2], 0));
        let layer = L.rectangle(bounds, pathStyle);

        this.addLayer(layer);
        layers.bbox = layer;

      }

      return layers;

    }

    /**
     * Allow the user to draw a bbox.
     */
    annotateBBox(){

      let index = this.state.annotations.length;
      let color = COLORS[index % COLORS.length];
      let pathStyle = this.createBBoxPathStyle(color);

      let drawer = new L.Draw.Rectangle(this.leafletMap, {
        shapeOptions : pathStyle,
        showArea : false,
        metric : false
      });

      this._currentDrawer = drawer;
      this._drawSuccessfullyCreated = false;

      drawer.enable();

    }

    /**
     * Allow all annotation layers to be edited.
     */
    enableEditing(){
      this.editor.enable();
      // Remove the edit styling for the markers.
      $( ".leaflet-marker-icon" ).removeClass( "leaflet-edit-marker-selected" );
    }

    /**
     * Fix all annotations.
     */
    disableEditing(){
      this.editor.disable();
    }

    _vertexDrawn(e){
      console.log("vertex drawn");
    }

    /**
     * We want cross hairs across the map when drawing a box.
     * @param {*} e
     */
    bboxCursorUpdate(e){

      let ch_horizontal = this.bbox_crosshairs[0];
      let ch_vertical = this.bbox_crosshairs[1];

      let offset = $(this.leafletHolderEl).offset();

      let x = e.pageX - offset.left;
      let y = e.pageY - offset.top;

      ch_horizontal.style.top = y + "px";
      ch_vertical.style.left = x + "px";

      //console.log("x= " + e.pageX + "  y= " + e.pageY);
    }

    _drawStartEvent(e){
      //console.log("draw start");

      if(this.annotating_bbox){

        // If the user clicks on the image (rather than clicking and dragging) then this
        // function will be called again, but we don't want to duplicate the cross hairs.
        if (this.bbox_crosshairs == null){

          // Setup cross hair stuff
          let ch_horizontal = document.createElement('div');
          let ch_vertical = document.createElement('div');

          ch_horizontal.className = "full-crosshair full-crosshair-horizontal";
          ch_vertical.className = "full-crosshair full-crosshair-vertical";

          ch_horizontal.style.top = "" + e.offsetY + "px";
          ch_vertical.style.left = "" + e.offsetX + "px";

          this.bbox_crosshairs = [ch_horizontal, ch_vertical];

          $(this.leafletHolderEl).append(ch_horizontal);
          $(this.leafletHolderEl).append(ch_vertical);
          $(this.leafletHolderEl).on('mousemove', this.bboxCursorUpdate);

        }
      }
    }

    /**
     * Check to see if the user successfully created the annotation (rectangle or marker).
     * If they didn't, then re-enable the drawer. This can occur (for example) when a user
     * clicks on the image when trying to draw a rectangle.
     * @param {*} e
     */
    _drawStopEvent(e) {
      //console.log("draw stop");

      // The user triggered some click, but didn't successfully create the annotation.
      if(this.state.annotating && !this._drawSuccessfullyCreated){
				this._currentDrawer.enable();
      }
      else{
        // Always turn off the mouse move
        $(this.leafletHolderEl).off('mousemove', this.bboxCursorUpdate);
        if(this.bbox_crosshairs != null){
          let ch_horizontal = this.bbox_crosshairs[0];
          let ch_vertical = this.bbox_crosshairs[1];
          $(ch_horizontal).remove();
          $(ch_vertical).remove();
          this.bbox_crosshairs = null;
        }
      }

    }

    /**
     * Save off the annotation layer that was just created.
     * @param {*} e
     */
    _drawCreatedEvent(e) {
      //console.log("draw created");

      // This is confusing, but we need to use another state variable
      // to decide if the user "messed up" the annotation:
      //		doing a single click for a bounding box, etc.
      this._drawSuccessfullyCreated = true;

      var layer = e.layer;

      if(this.annotating_bbox){

        // We want to clamp the box to the image bounds.
        layer = this.restrictBoxLayerToImage(layer);

        // Ensure that the layer is valid (null signifies the box has no area, or is completely off the image)
        if(layer != null){
          // This is a new instance. Grab the category that was chosen by the user for the new instance.
          let category = this.categoryMap[this.new_category_id];

          // Create the annotation data structure
          var annotation = {
            'image_id': this.props.image.id,
            'category_id': category.id,
            'bbox' : null,
            'keypoints' : null
          };


          // Create a mirror to hold the annotation layers
          var annotation_layer = {
            'bbox': layer,
            'keypoints': null
          };
          this.annotation_layers.push(annotation_layer);

          // Add the layer to the map
          this.addLayer(layer);

          // Add the annotation to our state
          this.setState(function(prevState, props){
            var annotations = prevState.annotations;
            annotations.push(annotation);
            return {
              'annnotations' : annotations
            };
          });
        }
      }

      // Unset all of the annotation properties
      this._currentDrawer = null;
      this.current_annotationIndex = null;
      this.current_keypointIndex = null;
      this.annotating_keypoint = false;
      this.annotating_bbox = false;
      this.new_category_id = null;

      this.setState({
        'annotating' : false
      });//, this.checkKeypointAnnotationQueue.bind(this));

      // Can the user edit boxes?
      if (this.props.enableEditing){
        this.enableEditing();
      }

    }

    _layerMoved(e){
      //console.log("layer moved");

    }

    _layerResized(e){
      //console.log("layer resized");

    }

    /**
     * Allow the user to annotate a new instance with a bbox.
     */
    createNewInstance() {

      if(this.state.annotating){
        // ignore, the user needs to finish their annotation.
        // Maybe we can flash a message
        return;
      }

      // if there is only one category, then this is real easy.
      var category;
      if (this.props.categories.length == 1){
        category = this.props.categories[0];

        // Draw a box
        this.disableEditing();
        this.annotating_bbox=true;
        this.new_category_id = category.id; // store the category that was selected.
        this.annotateBBox();
        this.setState({
          'annotating' : true,
        });

      }
      else{
        // How do we want the user to select the category?
        // Modal window?

        // edit the category afterwards?
        // what about a default category then?
        // or most recent category?

        // modal with an autocomplete and scroll view?

      }



    }

    /**
     * Cancel a bbox annotation.
     */
    cancelBBoxAnnotation(){

      this._drawSuccessfullyCreated = true;
      this._currentDrawer.disable();
      this._currentDrawer = null;

      this.annotating_bbox=false;
      this.new_category_id = null;

      this.setState({
        'annotating' : false,
      });
      if (this.props.enableEditing){
        this.enableEditing();
      }
    }

    /**
     * Add an annotation layer to the leaflet map.
     * @param {*} layer
     */
    addLayer(layer){
      if(layer != 'undefined' && layer != null){
        if(!this.annotationFeatures.hasLayer(layer)){
          this.annotationFeatures.addLayer(layer);

          // Remove the edit styling for the markers.
          $( ".leaflet-marker-icon" ).removeClass( "leaflet-edit-marker-selected" );
        }
      }
    }

    /**
     * Remove an annotation layer from the leaflet map.
     * @param {*} layer
     */
    removeLayer(layer){

      if(layer != 'undefined' && layer != null){
        if(this.annotationFeatures.hasLayer(layer)){
          this.annotationFeatures.removeLayer(layer);
        }
      }

    }

    /**
     * Delete an annotation, removing the annotation layers from the map.
     * @param {*} annotation_id
     */
    handleAnnotationDelete(annotation_id){

      // Need to check if we are annotating this instance
      if (this.state.annotating){
        if (this.current_annotationIndex == annotation_id){
          // Clear the annotation keypoint queue
          this.annotation_keypoint_queue = [];

          if(this.annotating_keypoint){
            this.cancelKeypointAnnotation();
          }
          else if(this.annotating_bbox){
            this.cancelBBoxAnnotation();
          }
        }
      }

      let annotation = this.state.annotations[annotation_id];
      let annotation_layer = this.annotation_layers[annotation_id];

      // Remove the bbox.
      if(annotation_layer.bbox != 'undefined' && annotation_layer.bbox != null){
        let layer = annotation_layer.bbox;
        this.removeLayer(layer);
      }

      // Remove the keypoints.
      if(annotation_layer.keypoints != 'undefined' && annotation_layer.keypoints != null){
        for( var i=0; i < annotation_layer.keypoints.length; i++){
          let layer = annotation_layer.keypoints[i];
          this.removeLayer(layer);
        }
      }

      this.setState(function(prevState, props){

        let annotations = prevState.annotations;
        // Mark the annotation as deleted. The server will delete it from the database
        annotations[annotation_id].deleted = true;

        return {
          'annotations' : annotations
        };

      });

    }

    /**
     * Restrict the box to the image bounds.
     * @param {*} layer
     */
    restrictBoxLayerToImage(layer){
      var bounds = layer.getBounds();
      var point1 = this.leafletMap.project(bounds.getNorthWest(), 0);
      var point2 = this.leafletMap.project(bounds.getSouthEast(), 0);

      var x1 = point1.x;
      var y1 = point1.y;
      var x2 = point2.x;
      var y2 = point2.y;

      [x1, y1] = this._restrictPointToImageBounds(x1, y1);
      [x2, y2] = this._restrictPointToImageBounds(x2, y2);

      // Is one of the deminsions 0?
      var valid=true;
      if(x2 - x1 <= 0){
        return null;
      }
      else if(y2 - y1 <= 0){
        return null;
      }

      point1 = L.point(x1, y1);
      point1 = this.leafletMap.unproject(point1, 0);
      point2 = L.point(x2, y2);
      point2 = this.leafletMap.unproject(point2, 0);

      bounds = [point1, point2];
      return L.rectangle(bounds, layer.options);
    }

    /**
     * Extract a bbox annotation from a bbox layer
     * @param {*} layer
     */
    extractBBox(layer){

      let bounds = layer.getBounds();
      let point1 = this.leafletMap.project(bounds.getNorthWest(), 0);
      let point2 = this.leafletMap.project(bounds.getSouthEast(), 0);

      var x1 = point1.x;
      var y1 = point1.y;
      var x2 = point2.x;
      var y2 = point2.y;

      [x1, y1] = this._restrictPointToImageBounds(x1, y1);
      [x2, y2] = this._restrictPointToImageBounds(x2, y2);

      let x = x1 / this.imageWidth;
      let y = y1 / this.imageHeight;
      let w = (x2 - x1) / this.imageWidth;
      let h = (y2 - y1) / this.imageHeight;

      return [x, y, w, h];

    }

    /**
     * Translate the point (if needed) so that it lies within the image bounds
     * @param  {[type]} x [description]
     * @param  {[type]} y [description]
     * @return {[type]}   [description]
     */
    _restrictPointToImageBounds(x, y){

      if(x > this.imageWidth){
        x = this.imageWidth;
      }
      else if(x < 0){
        x = 0;
      }
      if (y > this.imageHeight){
        y = this.imageHeight;
      }
      else if(y < 0){
        y = 0;
      }

      return [x, y];

    }


    getAnnotations(){

      let annotations = this.state.annotations;
      var annotations_to_save = [];
      let annotation_layers = this.annotation_layers;

      for (var i =0; i < annotations.length; i++){

        let annotation = annotations[i];

        // Ignore deleted annotations
        if(annotation.deleted){
          continue;
        }

        var new_annotation = $.extend(true, {}, annotation);
        let annotation_layer = annotation_layers[i];

        var new_bbox;

        if(annotation_layer['bbox'] != 'undefined' && annotation_layer['bbox'] != null){
          let layer = annotation_layer['bbox'];
          new_bbox = this.extractBBox(layer);
        }

        if (new_bbox != 'undefined'){
          new_annotation['bbox'] = new_bbox;
        }

        annotations_to_save.push(new_annotation);
      }

      return annotations_to_save;
    }

    getState(){
      let state = {
        'annotations' : this.getAnnotations(),
        'image' : this.props.image
      }
      return state;
    }

    /**
     * Extract the current state of the annotations and send them to our parent view.
     * The current positions of the bboxes and keypoints are extracted from their
     * corresponding layer.
     */
    // NOTE: need to remove this
    handleSave(){

      //let annotations_to_save = this.getAnnotations()
      //this.props.onSave(annotations_to_save);

    }

    /**
     * Focus on a particular instance by zooming in on it.
     * @param {*} annotationIndex
     */
    handleAnnotationFocus(annotationIndex){


      let annotation = this.state.annotations[annotationIndex];
      let annotation_layer = this.annotation_layers[annotationIndex];

      // lets show the annotations if they are not shown
      this.showAnnotation(annotation, annotation_layer);

      if(annotation_layer['bbox'] != 'undefined' && annotation_layer['bbox'] != null){
        let layer = annotation_layer['bbox'];
        let bounds = layer.getBounds();
        this.leafletMap.fitBounds(bounds);
      }

    }

    /**
     * Hide this annotation.
     * @param {*} annotation
     * @param {*} annotation_layer
     */
    hideAnnotation(annotation, annotation_layer){
      if(annotation_layer['bbox'] != 'undefined' && annotation_layer['bbox'] != null){
          let layer = annotation_layer['bbox'];
          this.removeLayer(layer);
      }
      if(annotation_layer['keypoints'] != 'undefined' && annotation_layer['keypoints'] != null){
        let keypoints = annotation.keypoints
        let keypoint_layers = annotation_layer['keypoints'];
        let category = this.categoryMap[annotation['category_id']];
        for(var j=0; j < category.keypoints.length; j++){
          let index = j * 3;
          let visibility = keypoints[index+2];

          if(visibility > 0){
            let layer = keypoint_layers[j];
            this.removeLayer(layer);
          }
        }
      }
    }

    /**
     * Hide all other annotations.
     * @param {*} annotationIndex
     */
    hideOtherAnnotations(annotationIndex){

      for(var i = 0; i < this.state.annotations.length; i++){

        let annotation = this.state.annotations[i];
        if (annotation.deleted != 'undefined' && annotation.deleted){
          continue;
        }

        let annotation_layer = this.annotation_layers[i];

        if (i == annotationIndex){
          // make sure this annotation is shown
          this.showAnnotation(annotation, annotation_layer);
        }
        else{
          // Hide the other annotations
          this.hideAnnotation(annotation, annotation_layer);
        }
      }

    }

    /**
     * Hide all of the annotations.
     */
    hideAllAnnotations(){

      for(var i = 0; i < this.state.annotations.length; i++){

        let annotation = this.state.annotations[i];
        if (annotation.deleted != 'undefined' && annotation.deleted){
          continue;
        }

        let annotation_layer = this.annotation_layers[i];

        this.hideAnnotation(annotation, annotation_layer);

      }

      // Rerender
      this.setState(this.state);

    }

    /**
     * Show this annotation.
     * @param {*} annotation
     * @param {*} annotation_layer
     */
    showAnnotation(annotation, annotation_layer){

      if(annotation_layer['bbox'] != 'undefined' && annotation_layer['bbox'] != null){
          let layer = annotation_layer['bbox'];
          this.addLayer(layer);
      }
      if(annotation_layer['keypoints'] != 'undefined' && annotation_layer['keypoints'] != null){
        let keypoints = annotation.keypoints;
        let keypoint_layers = annotation_layer['keypoints'];
        let category = this.categoryMap[annotation['category_id']];
        for(var j=0; j < category.keypoints.length; j++){
          let index = j * 3;
          let visibility = keypoints[index+2];

          if(visibility > 0){
            let layer = keypoint_layers[j];
            this.addLayer(layer);
          }
        }
      }

    }

    /**
     * Show all annotations.
     */
    showAllAnnotations(){

      for(var i = 0; i < this.state.annotations.length; i++){

        let annotation = this.state.annotations[i];
        if (annotation.deleted != 'undefined' && annotation.deleted){
          continue;
        }

        let annotation_layer = this.annotation_layers[i];

        this.showAnnotation(annotation, annotation_layer);

      }

      // Rerender
      this.setState(this.state);

    }

    render() {

        let image_id = this.props.image.id;
        let rights_holder = this.props.image.rights_holder;

        // Decide whether the "new box" button should be "cancel box" or not
        var newBoxEl;
        if(this.state.annotating){
          newBoxEl = <button type="button" className="btn btn-outline-primary" onClick={this.cancelBBoxAnnotation}>Cancel New Box</button>;
        }
        else{
          newBoxEl = <button type="button" className="btn btn-outline-primary" onClick={this.createNewInstance}>New Box</button>;
        }


        // Create the instructions element
        var instructionsEl = "";
        if(this.state.annotating){
          instructionsEl = (
            <div className="alert alert-success">
              <h4>Click and drag a box on the image.</h4>
            </div>
          );
        }
        else if(this.props.enableEditing){

          // Get the number of annotations (don't count deleted annotations)
          var num_annotations = 0;
          for(var i = 0; i < this.state.annotations.length; ++i){
            if (this.state.annotations[i].deleted == undefined || this.state.annotations[i].deleted == false){
              num_annotations += 1;
              break;
            }
          }
          if(num_annotations > 0){
            instructionsEl = (
              <div className="alert alert-info">
                <h4>Edit boxes.</h4>
              </div>
            );
          }
          else{
            instructionsEl = (
              <div className="alert alert-info">
                <h4>Click 'New Box' to draw a box.</h4>
              </div>
            );
          }
        }
        else{
          instructionsEl = (
            <div className="alert alert-warning">
              <h4>View mode only.</h4>
            </div>
          );
        }
        // var instructionsEl;
        // if (this.state.annotating){
        //   if (this.annotating_keypoint){

        //     let category = this.categoryMap[this.state.annotations[this.current_annotationIndex].category_id];
        //     let keypoint_name = category.keypoints[this.current_keypointIndex];
        //     instructionsEl = (<KeypointInstructions name={keypoint_name} />);

        //   }
        //   else if(this.annotating_bbox){
        //     let category = this.categoryMap[this.new_category_id];
        //     let name = category.name;
        //     instructionsEl = (<BBoxInstructions name={name} />);
        //   }
        // }
        // else{
        //   instructionsEl = (<DefaultEditInstructions />)
        // }

        // Build up the annotation side bar
        var annotation_els = [];
        for (var i=0; i < this.state.annotations.length; i++){

          let annotation = this.state.annotations[i];

          // Has this annotation been deleted?
          if (annotation.deleted != 'undefined' && annotation.deleted){
            continue;
          }

          // Is this annotation currently hidden?
          var hidden=false;
          if (this.annotationFeatures != null){ // It could be the case that we haven't rendered the map yet.
            hidden = !this.annotationFeatures.hasLayer(this.annotation_layers[i]['bbox']);
          }
          let category = this.categoryMap[annotation.category_id];

          annotation_els.push((
            <BBoxInstance key={i.toString()}
                        id={i}
                        category={category}
                        keypoints={annotation.keypoints}
                        handleKeypointVisibilityChange={ this.handleKeypointVisibilityChange }
                        handleDelete={ this.handleAnnotationDelete }
                        handleFocus={this.handleAnnotationFocus}
                        handleAnnotateKeypoints={this.handleAnnotateKeypoints}
                        handleHideOthers={this.hideOtherAnnotations}
                        hidden={hidden}/>
          ));
        }

        return (
          <div>
            <div className="row">
              <div className="col-8">
                <div className="row">
                  <div className="col">
                    <div ref={ e => { this.leafletHolderEl = e; }} className='leaflet-image-holder' ></div>
                  </div>
                </div>
                <div className="row">
                  <div className="col">
                    <span> Image ID: {image_id}</span>
                  </div>
                  <div className="col">
                    <span> Rights holder: {rights_holder}</span>
                  </div>
                </div>
              </div>
              <div className="col-4">
                <div className="row">
                  <div className="col">
                    {instructionsEl}
                  </div>
                </div>
                <div className="row">
                  <div className="col">
                    <div className="d-flex justify-content-between">
                      <div className="p-2">
                        {newBoxEl}
                      </div>
                      <div className="p-2">
                        <div className="btn-group" role="group">
                          <button type="button" className="btn btn-outline-secondary" onClick={this.hideAllAnnotations}>Hide All</button>
                          <button type="button" className="btn btn-outline-secondary" onClick={this.showAllAnnotations}>Show All</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col">
                    <div id="annotationAccordion" role="tablist" aria-multiselectable="true">
                      {annotation_els}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      );
    }
}