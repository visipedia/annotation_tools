import React from 'react';
import ReactDOM from 'react-dom';

import {ImageLoader} from './image_loader.js';
import {TaskSequence} from './task_seq.js';
import {BBoxAnnotation} from './bbox_annotation.js';
import {TaskInstructions} from './task_instructions.js';

import {MTurkFinishWrapper} from '../mturk.js';

class BBoxTask extends React.Component {

  constructor(props) {
      super(props);

      this.state = {
          imageElement : null
      };

      this.handleImageLoaded = this.handleImageLoaded.bind(this);
      this.handleImageFailed = this.handleImageFailed.bind(this);
      this.saveAnnotations = this.saveAnnotations.bind(this);

      this.start_time = null;
      this.end_time = null;
  }

  handleImageLoaded(imageElement) {
      this.setState({
          imageElement: imageElement
      });
  }

  handleImageFailed(){
      console.log('Image failed to load');
  }

  performSave(){
    if(this.leafletImage != 'undefined' && this.leafletImage != null){
      this.leafletImage.handleSave();

      var annotations = this.leafletImage.getAnnotations();

      if (annotations.length == 0){
        annotations
      }

      // tack on some extra information

    }
  }

  getState(){
    return this.leafletImage.getState();
  }

  checkPerformance(onSuccess, onFail){
    // This is a placeholder for handling gold questions
    onSuccess();
  }

  saveAnnotations(annotations){
    //console.log("saving annotations");

    // Tack on some extra information
    for(var i=0; i < annotations.length; i++){

    }

    $.ajax({
      url : "/bbox_task/save",
      method : 'POST',
      data : JSON.stringify({'annotations' : annotations}),
      contentType: 'application/json'
    }).done(function(){
      console.log("saved annotations");
    }).fail(function(){

    });
  }

  render() {

    if (this.state.imageElement == null){
      return (
          <ImageLoader url={this.props.image.url}
              onImageLoadSuccess={this.handleImageLoaded}
              onImageLoadError={this.handleImageFailed} />
      )
    }
    else{

      // Can the boxes be edited?
      var enableEditing = true;
      // Can the user immediately draw a box?
      var startNewInstance = true;
      if(this.props.visualize){
        enableEditing = false;
        startNewInstance = false;
      }

      return (
        <div>
          <div className="row">
            <div className="col">
              <BBoxAnnotation ref={m => { this.leafletImage = m; }}
                            imageElement={this.state.imageElement}
                            image={this.props.image}
                            annotations={this.props.annotations}
                            categories={this.props.categories}
                            enableEditing={enableEditing}
                            startNewInstance={startNewInstance}
                            onSave={this.saveAnnotations}/>
            </div>
          </div>
        </div>
      );
    }
  }

}

// Main driver. Handles showing the instructions, and then kicking off the task sequence,
// and then sending the results back to the server.
export let bboxTask = function(taskId, taskData, categories, mturk, taskInstructions){

  var onFinish;
  function submit(taskResults, onSuccess, onFailure){
    $.ajax({
      url : "/bbox_task/save",
      method : 'POST',
      data : JSON.stringify(taskResults),
      contentType: 'application/json'
    }).done(function(){
      console.log("Successfully saved bbox task results");

      if(onSuccess){
        onSuccess();
      }

      // Show finished page
      ReactDOM.render(
        (<div className="alert alert-success" role="alert">
          Finished!
        </div>),
        document.getElementById('app')
      );

    }).fail(function(){
      console.log("ERROR: failed to save bbox task results");

      if(onFailure){
        onFailure();
      }

      // Show finished page
      ReactDOM.render(
        (<div className="alert alert-danger" role="alert">
          Finished, but there was a problem saving the results.
        </div>),
        document.getElementById('app')
      );
    });
  }

  if (mturk){
    onFinish = MTurkFinishWrapper(submit);
  }
  else{
    onFinish = submit;
  }

  // Function to start the TaskSequence
  function onStart(){
    ReactDOM.render(
      <TaskSequence taskId={taskId} taskData={taskData} taskView={BBoxTask} categories={categories} onFinish={onFinish} taskInstructionModalId="bboxTaskHelpModal" taskHotKeysModalId="bboxTaskHotKeysModal" visualize={false}/>,
      document.getElementById('app')
    );
  }
  // Show the Start Page with the Task Instructions
  ReactDOM.render(
    <TaskInstructions {...taskInstructions} onStart={onStart}/>,
    document.getElementById('app')
  );

}

export let bboxTaskVisualize = function(taskData, categories){
  ReactDOM.render(
    <TaskSequence taskData={taskData} taskView={BBoxTask} categories={categories} visualize={true}/>,
    document.getElementById('app')
  );
}
