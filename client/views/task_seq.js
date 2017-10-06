import React from 'react';
import ReactDOM from 'react-dom';

import 'bootstrap';

import {KEYS} from '../utils.js';


/**
 * Perform a task on a sequence of images.
 */
export class TaskSequence extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            imageIndex : 0
        };

        this.prevImage = this.prevImage.bind(this);
        this.nextImage = this.nextImage.bind(this);
        this.finish = this.finish.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Initiliaze the saved task state
        this.savedTaskState = [];
        for(var i = 0; i < this.props.taskData.length; ++i){
          this.savedTaskState.push(null);
        }

        this.overallStartTime = new Date().getTime() / 1000;
    }

    componentDidMount(){
      document.addEventListener("keydown", this.handleKeyDown);
    }

    componentWillUnmount(){
      document.removeEventListener("keydown", this.handleKeyDown);
    }

    handleKeyDown(e){

      switch(e.keyCode){
        case KEYS.SPACE:
          this.nextImage();
          break;
        case KEYS.LEFT_ARROW:
          this.prevImage();
          break;
        case KEYS.RIGHT_ARROW:
          this.nextImage();
          break
      }

    }

    checkPerformance(onSuccess, onFail){
      /* Give the image a chance to provide feedback to the user.
      */
      this.taskViewRef.checkPerformance(onSuccess, onFail);
    }

    captureState(){
      /* Save off the annotations.
      */

      let endTime = new Date().getTime() / 1000;

      var state = this.taskViewRef.getState();

      // Store the amount of time the user has spent on this task
      let oldState = this.savedTaskState[this.state.imageIndex];
      var time;
      if(oldState == null){
        time = endTime - this.startTime;
      }
      else{
        time = oldState['time'] + endTime - this.startTime;
      }
      state['time'] = time;
      this.savedTaskState[this.state.imageIndex] = state;

    }

    prevImage(){

      this.checkPerformance(()=>{
        this.captureState();

        if(this.state.imageIndex == 0){
          return;
        }
        else{
          this.setState(function(prevState, props){
            return {
              imageIndex : prevState.imageIndex - 1,
            }
          });
        }
      }, ()=>{})
    }

    nextImage(){

      this.checkPerformance(()=>{

        if(this.state.imageIndex == this.props.taskData.length - 1){
          this.finish();
        }
        else{
          this.captureState();
          this.setState(function(prevState, props){
            return {
              imageIndex : prevState.imageIndex + 1
            }
          });
        }
      }, ()=>{})

    }

    finish(){

      this.checkPerformance(()=>{
        this.captureState();

        if(this.props.onFinish != null){

          let overallEndTime = new Date().getTime() / 1000;
          let task_results = {
            'results' : this.savedTaskState,
            'time' : overallEndTime - this.overallStartTime,
            'task_id' : this.props.taskId
          }

          this.props.onFinish(task_results);
        }
      }, ()=>{})
    }

    render() {

      this.startTime = new Date().getTime() / 1000;

      var taskData = this.savedTaskState[this.state.imageIndex];
      if (taskData == null){
        taskData = this.props.taskData[this.state.imageIndex];
      }

      let current_image = this.state.imageIndex + 1; // feedback for the user
      let num_images = this.props.taskData.length;

      // Determine which buttons we should render
      var buttons = []
      if(this.state.imageIndex > 0){
        buttons.push(
          (<button key="prevButton" type="button" className="btn btn-outline-secondary" onClick={this.prevImage}>Prev</button>)
        );
      }
      if(this.state.imageIndex < num_images - 1){
        buttons.push(
          (<button key="nextButton" type="button" className="btn btn-outline-secondary" onClick={this.nextImage}>Next</button>)
        );
      }
      if(this.state.imageIndex == num_images - 1){
        buttons.push(
          (<button key="finishButton" type="button" className="btn btn-outline-success" onClick={this.finish}>Finish</button>)
        );
      }

      var modalButtons = [];
      if (this.props.taskInstructionModalId != null){
        modalButtons.push(<button key="helpModal" type="button" className="btn btn-outline-primary" data-toggle="modal" data-target={"#" + this.props.taskInstructionModalId}>Help</button>);
      }
      if (this.props.taskHotKeysModalId != null){
        modalButtons.push(<button key="hotKeysModal" type="button" className="btn btn-outline-primary" data-toggle="modal" data-target={"#" + this.props.taskHotKeysModalId}>Hot Keys</button>);
      }

      return (
        <div>
          <div className="row">
            <div className="col">
              <this.props.taskView ref={ e => { this.taskViewRef = e; }}
                              image={taskData.image}
                              annotations={taskData.annotations}
                              categories={this.props.categories}
                              key={this.state.imageIndex}
                              visualize={this.props.visualize}/>
            </div>
          </div>

          <nav className="navbar fixed-bottom navbar-light bg-light">
            <div className="ml-auto">
                <div className="btn-group" role="group">
                  {buttons}
                </div>
                  <span> Image {current_image} / {num_images} </span>
            </div>
            <div className="ml-auto">
                {modalButtons}
            </div>
          </nav>
        </div>
      )
    }

}

TaskSequence.defaultProps = {
  taskData : [], // Array of image dicts
  onFinish : null, // a function to call when the image sequence is finished.
  categories : null, // Categories array,
  taskInstructionModalId : null,
  taskHotKeysModalId: null,
  visualize: false // Are we visualizing the results of a task?
};