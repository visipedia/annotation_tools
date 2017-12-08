import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';
import 'bootstrap';

import L from 'leaflet';
import '../leaflet.draw/leaflet.draw.js';

import {COLORS} from '../utils.js';
import {Annotation} from './annotation.js';
import {DefaultEditInstructions, KeypointInstructions, BBoxInstructions} from './instructions.js';
import {CategorySelectionModal} from './category_selection_modal.js';


// Convenience class for creating circular markers of a specific color.
let ColorableDivIcon = L.DivIcon.extend({

  setBackground : function(background){
    this.background = background;
  },

  setColor : function(color){
    this.color = color;
  },

  createIcon : function(oldIcon){

    let div = L.DivIcon.prototype.createIcon.call(this, oldIcon);

    div.style.backgroundColor = this.options.style.fillColor;
    let diameter = '' + (this.options.style.radius * 2) + 'px';
    div.style.height = diameter;
    div.style.width = diameter;

    if (this.background != 'undefined' && this.background != null){
      div.style.background = this.background;
    }

    return div;

  }

});


export class LeafletAnnotation extends React.Component {

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

        this.handleKeypointVisibilityChange = this.handleKeypointVisibilityChange.bind(this);
        this.createNewInstance = this.createNewInstance.bind(this);
        this.handleAnnotationDelete = this.handleAnnotationDelete.bind(this);
        this.handleSave = this.handleSave.bind(this);
        this.checkKeypointAnnotationQueue = this.checkKeypointAnnotationQueue.bind(this);
        this.handleAnnotationFocus = this.handleAnnotationFocus.bind(this);
        this.handleAnnotateKeypoints = this.handleAnnotateKeypoints.bind(this);
        this.hideOtherAnnotations = this.hideOtherAnnotations.bind(this);
        this.hideAllAnnotations = this.hideAllAnnotations.bind(this);
        this.showAllAnnotations = this.showAllAnnotations.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        this.bboxCursorUpdate = this.bboxCursorUpdate.bind(this);

        this.categorySelection = this.categorySelection.bind(this);
        this.categorySelectionCancelled = this.categorySelectionCancelled.bind(this);

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


      // We'll use this list to mirror the json annotations
      this.annotation_layers = [];
      // Add the annotations
      for(var i=0; i < this.state.annotations.length; i++){
        this.annotation_layers.push(this.addAnnotation(this.state.annotations[i], i));
      }

      // Should we enable editing immediately?
      if (this.props.enableEditing){
        this.enableEditing();
      }

      this.enableHotKeys();

    }

    componentWillUnmount(){
      this.disableHotKeys();
    }

    enableHotKeys(){
      // Register keypresses
      document.addEventListener("keydown", this.handleKeyDown);
    }

    disableHotKeys(){
      // Unregister keypresses
      document.removeEventListener("keydown", this.handleKeyDown);
    }

    handleKeyDown(e){

      let ESCAPE_KEY = 27; // Quit / Cancel annotation
      let S_KEY = 83; // Save annotations
      let N_KEY = 78; // New instance
      let V_KEY = 86; // Toggle visibility


      switch(e.keyCode){
        case ESCAPE_KEY:
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
        case S_KEY:
          this.handleSave();
          break;
        case N_KEY:
          this.createNewInstance();
          break;
        case V_KEY:
          this.toggleKeypointVisibility();
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

    createKeypointPathStyle(color) {
      return {
        'color' : color,
        'stroke' : false,
        'weight' : 5,
        'opacity' : 0.5,
        'fill' : true,
        'fillColor' : color,
        'fillOpacity' : 1,
        'radius' : 5
      }
    }

    createKeypointSolidBackgroundStyle(color){
      return "" + color;
    }

    createKeypointStripedBackgroundStyle(color){
      return "repeating-linear-gradient(   45deg,   " + color + ",   " + color + " 2px,   black 2px,   black 4px )";
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

        var [x, y, w, h] = annotation.bbox;
        let x1 = x * imageWidth;
        let y1 = y * imageHeight;
        let x2 = (x + w) * imageWidth;
        let y2 = (y + h) * imageHeight;
        let bounds = L.latLngBounds(this.leafletMap.unproject([x1, y1], 0), this.leafletMap.unproject([x2, y2], 0));
        let layer = L.rectangle(bounds, pathStyle);

        this.addLayer(layer);
        layers.bbox = layer;

      }

      // Add the keypoints
      if(annotation.keypoints != 'undefined' && annotation.keypoints != null){
        layers['keypoints'] = [];

        // We should just assume that these exist...
        let keypoint_names = null;
        let keypoint_styles = null;
        if(category != null){
          keypoint_names = category['keypoints'];
          keypoint_styles = category['keypoints_style'];
        }

        // Render a marker for each keypoint
        for( var i = 0; i < annotation.keypoints.length / 3; i++){

          let keypoint_name = keypoint_names[i];
          let keypoint_color = keypoint_styles[i];

          let index = i * 3;
          var x = annotation.keypoints[index];
          var y = annotation.keypoints[index + 1];
          var v = annotation.keypoints[index + 2];

          var layer = null;
          if (v > 0){

            x = x * imageWidth;
            y = y * imageHeight;
            let latlng = this.leafletMap.unproject([x,y], 0);

            var marker = new ColorableDivIcon({
              iconAnchor : [6, 6],
              popupAnchor : [0, -6],
              className : 'circle-marker',
              style : this.createKeypointPathStyle(keypoint_color)
            });
            if (v == 1){
              marker.setBackground(this.createKeypointStripedBackgroundStyle(keypoint_color));
            }

            layer = L.marker(latlng, {icon : marker});
            layer.bindTooltip(keypoint_name, {
              className : '',
              direction : 'auto'
            });
            this.addLayer(layer);

          }

          layers['keypoints'].push(layer);

        }

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
     * Allow the user to click on the image to annotate a keypoint.
     * @param {*} keypoint_color
     * @param {*} keypoint_name
     */
    annotateKeypoint(keypoint_color, keypoint_name, visibility){

      var marker = new ColorableDivIcon({
        iconAnchor : [6, 6],
        popupAnchor : [0, -6],
        className : 'circle-marker',
        style : this.createKeypointPathStyle(keypoint_color)
      });
      if (visibility == 1){
        marker.setBackground(this.createKeypointStripedBackgroundStyle(keypoint_color));
      }
      else{
        marker.setBackground(this.createKeypointSolidBackgroundStyle(keypoint_color));
      }

      let drawer = new L.Draw.Marker(this.leafletMap, {icon : marker});

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

    bboxCursorUpdate(e){
      let ch_horizontal = this.bbox_crosshairs[0];
      let ch_vertical = this.bbox_crosshairs[1];

      let offset = $(this.leafletHolderEl).offset();

      let x = e.pageX - offset.left;
      let y = e.pageY - offset.top;

      ch_horizontal.style.top = y + "px";
      ch_vertical.style.left = x + "px";
    }

    _drawStartEvent(e){
      console.log("draw start");

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
      console.log("draw stop");
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
      console.log("draw created");
      // This is confusing, but we need to use another state variable
      // to decide if the user "messed up" the annotation:
      //		doing a single click for a bounding box, etc.
      this._drawSuccessfullyCreated = true;

      var layer = e.layer;


      // Were we annotating a keypoint?
      if(this.annotating_keypoint){

        this.addLayer(layer);

        // Save off the layer
        this.annotation_layers[this.current_annotationIndex]['keypoints'][this.current_keypointIndex] = layer;

        let annotation = this.state.annotations[this.current_annotationIndex];
        let category = this.categoryMap[annotation['category_id']];
        let visibility = annotation.keypoints[this.current_keypointIndex * 3 + 2];

        // Set the background style
        let keypoint_color = category['keypoints_style'][this.current_keypointIndex];
        if (visibility == 1){
          layer.getElement().style.background = this.createKeypointStripedBackgroundStyle(keypoint_color);
        }
        else{
          layer.getElement().style.background = this.createKeypointSolidBackgroundStyle(keypoint_color);
        }

        // Add a tooltip to the marker that displays the keypoint name
        let keypoint_name = category['keypoints'][this.current_keypointIndex];
        layer.bindTooltip(keypoint_name, {
          className : '',
          direction : 'auto'
        });

      }
      else if(this.annotating_bbox){

        // We want to clamp the box to the image bounds.
        layer = this.restrictBoxLayerToImage(layer);
        this.addLayer(layer);

        // This is a new instance. Grab the category that was chosen by the user for the new instance.
        let category = this.categoryMap[this.new_category_id];

        // Initialize the keypoints with default values.
        var keypoints = null;
        var keypoint_layers = null;
        if(category.keypoints && category.keypoints.length > 0){
          keypoints = []
          keypoint_layers = []
          for(var j = 0; j < category.keypoints.length; j++){
            var [x, y, v] = [0, 0, 0];
            keypoints.push(x);
            keypoints.push(y);
            keypoints.push(v);
            keypoint_layers.push(null);
          }
        }

        // Create the annotation data structure
        var annotation = {
          'image_id': this.props.image.id,
          'category_id': category.id,
          'bbox' : null,
          'keypoints' : keypoints
        };

        // Create a mirror to hold the annotation layers
        var annotation_layer = {
          'bbox': layer,
          'keypoints': keypoint_layers
        };
        this.annotation_layers.push(annotation_layer);

        // Make a queue of the keypoints to annotate for this new instance.
        if(this.annotate_keypoints_for_new_instances && keypoints != null){
          let annotation_index = this.annotation_layers.length - 1;
          this.annotation_keypoint_queue = [];
          for(var j = 0; j < category.keypoints.length; j++){
            this.annotation_keypoint_queue.push({
              annotationIndex : annotation_index,
              keypointIndex : j
            });
          }
        }

        // Add the annotation to our state
        this.setState(function(prevState, props){
          var annotations = prevState.annotations;
          annotations.push(annotation);
          return {
            'annnotations' : annotations
          };
        });

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
      }, this.checkKeypointAnnotationQueue.bind(this));

      // If this is the first instance, then we need to enable editing.
      if (this.props.enableEditing){
        this.enableEditing();
      }

    }

    /**
     * We can queue up keypoint annotations and iterate through them.
     */
    checkKeypointAnnotationQueue(){
      // When a new instance is created we can queue up the keypoints to annotate
      if (this.annotation_keypoint_queue.length > 0){
        let anno = this.annotation_keypoint_queue.shift();
        this.handleKeypointVisibilityChange(anno['annotationIndex'], anno['keypointIndex'], 2);
      }
    }

    _layerMoved(e){
      //console.log("layer moved");

    }

    _layerResized(e){
      //console.log("layer resized");

    }

    /**
     * Handle a change in keypoint visibility. Either hide, show or annotate the keypoint.
     * @param {*} annotationIndex
     * @param {*} keypointIndex
     * @param {*} visibility
     */
    handleKeypointVisibilityChange(annotationIndex, keypointIndex, visibility){
      //console.log("annotation " + annotationIndex + " keypoint " + keypointIndex + " vis " + visibility);

      // If we are in the middle of annotating something else, then ignore this request
      if (this.state.annotating){
          if (!(this.current_annotationIndex == annotationIndex && this.annotating_keypoint && this.current_keypointIndex == keypointIndex)){
            return;
          }
      }

      let prev_visibility = this.state.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2];

      if (visibility == 0){

        // Are we currently annotating?
        if (this.state.annotating){
          // Are we currently annotating this keypoint?
          if (this.current_annotationIndex == annotationIndex && this.annotating_keypoint && this.current_keypointIndex == keypointIndex){
            // cancel the drawer

            this.cancelKeypointAnnotation()

          }
        }
        else{
          // was this keypoint visible?
          if (prev_visibility > 0){
            // remove the keypoint layer
            let keypoint_layer = this.annotation_layers[annotationIndex]['keypoints'][keypointIndex];
            this.annotationFeatures.removeLayer(keypoint_layer);
          }

          this.setState(function(prevState, props){
            prevState.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2] = 0;
            return {
              'annotations' : prevState.annotations
            };
          });
        }
      }

      else if (visibility == 1 || visibility == 2){

        // Are we currently annotating this keypoing (and just toggled the visibility)
        if (this.state.annotating){
          // Are we currently annotating this keypoint?
          if (this.current_annotationIndex == annotationIndex && this.annotating_keypoint && this.current_keypointIndex == keypointIndex){


            // Not the most elegant...
            if (this._currentDrawer._marker != undefined){
              let annotation = this.state.annotations[annotationIndex];
              let category = this.categoryMap[annotation['category_id']];
              let keypoint_color = category['keypoints_style'][keypointIndex];
              if (visibility == 1){
                this._currentDrawer._marker.getElement().style.background = this.createKeypointStripedBackgroundStyle(keypoint_color);
              }
              else{
                this._currentDrawer._marker.getElement().style.background = this.createKeypointSolidBackgroundStyle(keypoint_color);
              }
            }
            // Just update the visibility
            this.setState(function(prevState, props){
              prevState.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2] = visibility;
              return {
                'annotations' : prevState.annotations
              };
            });
          }
        }
        else{

          // Does a layer exist for this keypoint?
          var keypoint_layer = this.annotation_layers[annotationIndex]['keypoints'][keypointIndex];
          if(keypoint_layer != null){
            if (prev_visibility == 0){
              // just render the existing layer
              this.addLayer(keypoint_layer);
            }

            let annotation = this.state.annotations[annotationIndex];
            let category = this.categoryMap[annotation['category_id']];
            let keypoint_color = category['keypoints_style'][keypointIndex];
            if (visibility == 1){
              keypoint_layer.getElement().style.background = this.createKeypointStripedBackgroundStyle(keypoint_color);
            }
            else{
              keypoint_layer.getElement().style.background = this.createKeypointSolidBackgroundStyle(keypoint_color);;
            }

            this.setState(function(prevState, props){
              prevState.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2] = visibility;
              return {
                'annotations' : prevState.annotations
              };
            }, this.checkKeypointAnnotationQueue.bind(this));

          }
          else{
            // we need to annotate this keypoint
            let annotation = this.state.annotations[annotationIndex];
            let category = this.categoryMap[annotation['category_id']];
            let keypoint_name = category['keypoints'][keypointIndex];
            let keypoint_color = category['keypoints_style'][keypointIndex];


            // Set the annotating state
            this.annotateKeypoint(keypoint_color, keypoint_name, visibility)

            this.current_annotationIndex = annotationIndex;
            this.annotating_keypoint = true;
            this.current_keypointIndex = keypointIndex;

            this.setState(function(prevState, props){
              prevState.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2] = visibility;
              return {
                'annotating' : true,
                'annotations' : prevState.annotations
              };
            });
          }
        }
      }
    }

    /**
     * Toggle the visibility of the current keypoint from 2 -> 1 or 1 -> 0.
     * Toggling from 1 -> 0 will cancel the annotation.
     */
    toggleKeypointVisibility(){
      if (this.state.annotating && this.annotating_keypoint){
        let annotationIndex = this.current_annotationIndex;
        let keypointIndex = this.current_keypointIndex;
        let current_visibility = this.state.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2];

        if(current_visibility == 2){
          this.handleKeypointVisibilityChange(annotationIndex, keypointIndex, 1);
        }
        else if(current_visibility == 1){
          this.handleKeypointVisibilityChange(annotationIndex, keypointIndex, 0);
        }
      }
    }

    /**
     * Cancel a keypoint annotation, setting the visibility to 0.
     */
    cancelKeypointAnnotation(){

      // cancel the drawer
      this._drawSuccessfullyCreated = true;
      this._currentDrawer.disable();
      this._currentDrawer = null;

      let annotationIndex = this.current_annotationIndex;
      let keypointIndex = this.current_keypointIndex;

      this.annotating_keypoint = false;
      this.current_annotationIndex = null;
      this.current_keypointIndex = null;

      this.setState(function(prevState, props){

        prevState.annotations[annotationIndex]['keypoints'][keypointIndex * 3 + 2] = 0;
        return {
          'annotations' : prevState.annotations,
          'annotating' : false
        };
      }, this.checkKeypointAnnotationQueue.bind(this)); // Check the queue to see if there is another keypoint

    }


    categorySelection(category_idx){
      $('#categorySelectionModal').modal('hide');
      this.categorySelectionModalEl = null;
      this.addNewInstance(category_idx);
      this.enableHotKeys();
    }

    categorySelectionCancelled(){
      $('#categorySelectionModal').modal('hide');
      this.categorySelectionModalEl = null;
      this.enableHotKeys();
    }

    /**
     *
     * @param {*} category_idx integer index into our props.categories array
     */
    addNewInstance(category_idx){
      let category = this.props.categories[category_idx];

      // Draw a box
      this.annotating_bbox=true;
      this.new_category_id = category.id; // store the category that was selected.
      this.annotateBBox();
      this.setState({
        'annotating' : true,
      });

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
        this.addNewInstance(0);
      }
      else{

        // Show a modal window and let the user select the category.
        ReactDOM.render(
          <CategorySelectionModal ref={(el) => {this.categorySelectionModalEl = el; }} categories={this.props.categories} cancelled={this.categorySelectionCancelled}
            selected={this.categorySelection}/>,
          document.getElementById('categorySelectionModalContent')
        );

        // We don't want hot keys firing when the user is using the filter box
        this.disableHotKeys();

        // let the modal focus the input
        $('#categorySelectionModal').off('shown.bs.modal'); // we don't want to keep tacking on events
        $('#categorySelectionModal').on('shown.bs.modal', ()=>{this.categorySelectionModalEl.shown();});
        $('#categorySelectionModal').modal('show');

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
     * Extract a keypoint annotation from a keypoint layer.
     * @param {*} layers
     */
    extractKeypoint(layer){
      let point = layer.getLatLng();
      point = this.leafletMap.project(point, 0);
      let x1 = point.x;
      let y1 = point.y;
      [x1, y1] = this._restrictPointToImageBounds(x1, y1);
      let x = x1 / this.imageWidth;
      let y = y1 / this.imageHeight;

      return [x,y];
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

    /**
     * Extract the current state of the annotations and send them to our parent view.
     * The current positions of the bboxes and keypoints are extracted from their
     * corresponding layer.
     */
    handleSave(){

      let annotations = this.state.annotations;
      var annotations_to_save = [];
      let annotation_layers = this.annotation_layers;

      for (var i =0; i < annotations.length; i++){

        let annotation = annotations[i];
        var new_annotation = $.extend(true, {}, annotation);
        let annotation_layer = annotation_layers[i];

        var new_bbox;
        var new_keypoints;

        if(annotation_layer['bbox'] != 'undefined' && annotation_layer['bbox'] != null){
          let layer = annotation_layer['bbox'];
          new_bbox = this.extractBBox(layer);
        }

        if(annotation_layer['keypoints'] != 'undefined' && annotation_layer['keypoints'] != null){
          let old_keypoint_annotations = annotation.keypoints;
          new_keypoints = [];
          let keypoint_layers = annotation_layer['keypoints'];
          let category = this.categoryMap[annotation['category_id']];
          for(var j=0; j < category.keypoints.length; j++){
            let index = j * 3;
            let visibility = old_keypoint_annotations[index+2];

            if(visibility > 0){

              let layer = keypoint_layers[j];

              if(layer != 'undefined' && layer != null){
                let [x, y] = this.extractKeypoint(layer);

                new_keypoints.push(x);
                new_keypoints.push(y);
                new_keypoints.push(visibility);

              }
            }
            else{
              new_keypoints.push(0);
              new_keypoints.push(0);
              new_keypoints.push(0);
            }
          }

        }

        if (new_bbox != 'undefined'){
          new_annotation['bbox'] = new_bbox;
        }
        if (new_keypoints != 'undefined'){
          new_annotation['keypoints'] = new_keypoints;
        }
        annotations_to_save.push(new_annotation);
      }

      this.props.onSave(annotations_to_save);

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
     * Collect all the keypoints marked with visibility 0 and let the user annotate them.
     * @param {*} annotationIndex
     */
    handleAnnotateKeypoints(annotationIndex){

      if (this.state.annotating){
        // ignore
        return;
      }

      let annotation = this.state.annotations[annotationIndex];
      let annotation_layer = this.annotation_layers[annotationIndex];

      // lets show the annotations if they are not shown
      this.showAnnotation(annotation, annotation_layer);


      let category = this.categoryMap[annotation.category_id];

      if(category.keypoints){

        this.annotation_keypoint_queue = [];
        for (var j=0; j < category.keypoints.length; j++){
          let index = j * 3;
          let visibility = annotation.keypoints[index + 2];
          if (visibility == 0){
            this.annotation_keypoint_queue.push({
              'annotationIndex' : annotationIndex,
              'keypointIndex' : j
            });
          }
        }

        this.checkKeypointAnnotationQueue();
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

        // Create the instructions element
        var instructionsEl;
        if (this.state.annotating){
          if (this.annotating_keypoint){

            let category = this.categoryMap[this.state.annotations[this.current_annotationIndex].category_id];
            let keypoint_name = category.keypoints[this.current_keypointIndex];
            instructionsEl = (<KeypointInstructions name={keypoint_name} />);

          }
          else if(this.annotating_bbox){
            let category = this.categoryMap[this.new_category_id];
            let name = category.name;
            instructionsEl = (<BBoxInstructions name={name} />);
          }
        }
        else{
          instructionsEl = (<DefaultEditInstructions />)
        }

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

          var keypoint_els = [];
          annotation_els.push((
            <Annotation key={i.toString()}
                        id={i}
                        category={category}
                        keypoints={annotation.keypoints ? annotation.keypoints : []}
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
              <div className="col-6">
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
              <div className="col-6">
                <div className="d-flex justify-content-between">
                  <div className="p-2">
                    <button type="button" className="btn btn-outline-primary" onClick={this.createNewInstance}>New</button>
                  </div>
                  <div className="p-2">
                    <div className="btn-group" role="group">
                      <button type="button" className="btn btn-outline-secondary" onClick={this.hideAllAnnotations}>Hide All</button>
                      <button type="button" className="btn btn-outline-secondary" onClick={this.showAllAnnotations}>Show All</button>
                    </div>
                  </div>
                  <div className="p-2">
                    <button type="button" className="btn btn-outline-success" onClick={this.handleSave}>Save</button>
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
            <div className="row">
              <div className="col"></div>
              <div className="col-10">
                {instructionsEl}
              </div>
              <div className="col"></div>
            </div>
          </div>
      );
    }
}